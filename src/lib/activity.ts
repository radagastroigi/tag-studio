import type { SupabaseClient } from '@supabase/supabase-js';

export interface ActivityPayload {
  title: string;
  category: string;
  duration_mins: number;
  goal_id?: string | null;
}

export async function logActivitySafe(
  supabase: SupabaseClient,
  payload: ActivityPayload
) {
  const client_mutation_id = crypto.randomUUID();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('activity_logs')
    .insert({ ...payload, user_id: user.id, client_mutation_id })
    .select()
    .single();

  if (error && error.code !== '23505') {
    throw error;
  }
  return data;
}
