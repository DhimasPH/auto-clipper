import axios from "axios";
import { API_URL } from "./platform/backendUrl";

export const apiGetClipWords = async (jobId: string, clipIndex: number) => {
  const res = await axios.get(`${API_URL}/jobs/${jobId}/clips/${clipIndex}/words`);
  return res.data;
};

export const apiCorrectSubtitle = async (payload: any) => {
  const res = await axios.post(`${API_URL}/api/ai/correct-subtitle`, payload);
  return res.data;
};

export const apiCreateClipRerenderJob = async (jobId: string, clipIndex: number, payload: any) => {
  const res = await axios.post(`${API_URL}/jobs/${jobId}/clips/${clipIndex}/rerender`, payload);
  return res.data;
};

export interface GDriveItem {
  name: string;
  is_dir: boolean;
  path: string;
}

export interface GDriveListing {
  items: GDriveItem[];
  current_dir: string;
  parent_dir: string | null;
}

/** A folder of the Colab Google Drive (cloud only). Throws when the backend refuses. */
export const apiBrowseGDrive = async (dirPath?: string): Promise<GDriveListing> => {
  const res = await axios.get(`${API_URL}/gdrive-browser`, { params: dirPath ? { dir_path: dirPath } : {} });
  if (res.data?.status !== "success") throw new Error(res.data?.message || "gdrive-browser failed");
  return { items: res.data.items || [], current_dir: res.data.current_dir || "", parent_dir: res.data.parent_dir ?? null };
};

/** Upload a canvas background image (spec 4.7); returns the path the backend reads it from. */
export const uploadCanvasImage = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append("file", file);
  const res = await axios.post(`${API_URL}/upload-image`, form);
  if (res.data?.status !== "success" || typeof res.data.path !== "string") {
    throw new Error(res.data?.message || "upload-image failed");
  }
  return res.data.path;
};
