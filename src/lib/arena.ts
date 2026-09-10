import { supabase } from "./supabase";

/**
 * §8 — the community-topics functions (listTopics / addTopic / voteTopic /
 * fetchTopicLeaderboard) are deleted along with their UI: topic voting and
 * "اقترح موضوعاً" are gone, and migration 021 drops the arena_topic_votes
 * table + bump_topic_votes RPC. The arena_topics TABLE itself remains —
 * battle rooms reference it as the topic registry (see joinBattleRoom).
 */

export type ArenaEntry = {
  id: string;
  topic_id: string;
  user_id: string;
  score: number;
  created_at: string;
  username?: string;
};

export async function submitEntry(input: {
  topicId: string;
  userId: string;
  garment: string;
  color: string;
  description: string;
  score: number;
  creativity: number;
  craft: number;
  topicFit: number;
  verdict: string;
}): Promise<ArenaEntry | null> {
  const { data, error } = await supabase
    .from("arena_entries")
    .insert({
      topic_id: input.topicId,
      user_id: input.userId,
      garment: input.garment,
      color: input.color,
      description: input.description,
      score: input.score,
      creativity: input.creativity,
      craft: input.craft,
      topic_fit: input.topicFit,
      verdict: input.verdict,
    })
    .select()
    .single();
  if (error) {
    console.error("Failed to submit entry:", error.message);
    return null;
  }
  return data as ArenaEntry;
}

/** Top scores for one topic — the real, shared battle leaderboard. */
export async function fetchTopicLeaderboard(topicId: string, limit = 10): Promise<ArenaEntry[]> {
  const { data, error } = await supabase
    .from("arena_entries")
    .select("id, topic_id, user_id, score, created_at, profiles!arena_entries_user_id_fkey(username)")
    .eq("topic_id", topicId)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Failed to load topic leaderboard:", error.message);
    return [];
  }
  return (data as any[]).map((row) => ({
    id: row.id,
    topic_id: row.topic_id,
    user_id: row.user_id,
    score: row.score,
    created_at: row.created_at,
    username: row.profiles?.username,
  }));
}
