import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';

const WORKOUTS_KEY = 'workouts';

async function fetchWorkouts(params = {}) {
  const { data } = await axios.get('/api/workouts', { params });
  return data.data;
}

async function fetchWorkout(id) {
  const { data } = await axios.get(`/api/workouts/${id}`);
  return data.data;
}

async function createWorkout(payload) {
  const { data } = await axios.post('/api/workouts', payload);
  return data.data;
}

async function updateWorkout({ id, ...payload }) {
  const { data } = await axios.put(`/api/workouts/${id}`, payload);
  return data.data;
}

async function deleteWorkout(id) {
  const { data } = await axios.delete(`/api/workouts/${id}`);
  return data.data;
}

export function useWorkouts(params) {
  return useQuery({
    queryKey: [WORKOUTS_KEY, params],
    queryFn: () => fetchWorkouts(params),
  });
}

export function useWorkout(id) {
  return useQuery({
    queryKey: [WORKOUTS_KEY, id],
    queryFn: () => fetchWorkout(id),
    enabled: !!id,
  });
}

export function useCreateWorkout() {
  const qc = useQueryClient();
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: createWorkout,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORKOUTS_KEY] });
      refreshUser();
    },
  });
}

export function useUpdateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateWorkout,
    onSuccess: () => qc.invalidateQueries({ queryKey: [WORKOUTS_KEY] }),
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkout,
    onSuccess: () => qc.invalidateQueries({ queryKey: [WORKOUTS_KEY] }),
  });
}
