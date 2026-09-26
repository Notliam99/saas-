import type { EvidencePhoto } from '@/components/evidence-photo-picker';
import { supabase } from '@/lib/supabase';

export type EvidenceSide = 'prosecution' | 'defense';

export type CaseEvidenceImage = {
  id: string;
  case_id: string;
  evidence_side: EvidenceSide;
  signed_url: string;
};

const BUCKET = 'case-evidence';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export async function uploadCaseEvidence({
  caseId,
  householdId,
  userId,
  side,
  photos,
}: {
  caseId: string;
  householdId: string;
  userId: string;
  side: EvidenceSide;
  photos: EvidencePhoto[];
}) {
  if (!photos.length) return;

  const uploadedPaths: string[] = [];
  try {
    for (const photo of photos) {
      const contentType = photo.mimeType?.toLowerCase() || 'image/jpeg';
      const extension = IMAGE_EXTENSIONS[contentType];
      if (!extension) {
        throw new Error('That image format is not supported. Please choose a JPEG, PNG, WebP, or HEIC photo.');
      }

      const response = await fetch(photo.uri);
      if (!response.ok) throw new Error('Could not read one of the selected photos. Please choose it again.');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_FILE_BYTES) {
        throw new Error('Each photo must be 5 MB or smaller. Please choose a smaller image.');
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const path = `${householdId}/${caseId}/${side}/${userId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
        cacheControl: '3600',
        contentType,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);
    }

    const { error: recordError } = await supabase.from('case_evidence').insert(
      uploadedPaths.map((storagePath) => ({
        case_id: caseId,
        uploaded_by: userId,
        evidence_side: side,
        storage_path: storagePath,
      })),
    );
    if (recordError) throw recordError;
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from(BUCKET).remove(uploadedPaths);
    }
    throw error;
  }
}

export async function removeCaseEvidence(caseId: string, side: EvidenceSide, userId: string) {
  const { data, error: readError } = await supabase
    .from('case_evidence')
    .select('storage_path')
    .eq('case_id', caseId)
    .eq('evidence_side', side)
    .eq('uploaded_by', userId);
  if (readError) throw readError;

  const paths = (data ?? []).map((item) => item.storage_path);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) throw storageError;
  }

  const { error: deleteError } = await supabase
    .from('case_evidence')
    .delete()
    .eq('case_id', caseId)
    .eq('evidence_side', side)
    .eq('uploaded_by', userId);
  if (deleteError) throw deleteError;
}

export async function loadCaseEvidence(caseIds: string[]): Promise<CaseEvidenceImage[]> {
  if (!caseIds.length) return [];

  const { data, error } = await supabase
    .from('case_evidence')
    .select('id, case_id, evidence_side, storage_path')
    .in('case_id', caseIds);
  if (error) throw error;

  const images = await Promise.all((data ?? []).map(async (item) => {
    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(item.storage_path, 60 * 60);
    if (signedError) throw signedError;
    return {
      id: item.id,
      case_id: item.case_id,
      evidence_side: item.evidence_side as EvidenceSide,
      signed_url: signed.signedUrl,
    };
  }));

  return images;
}
