import axios from 'axios';
import { API_URL } from './App';

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
