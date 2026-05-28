import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

async function fetchDashboardStats() {
  const { data } = await axios.get('/api/user/stats');
  return data.data;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
