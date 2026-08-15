export type ChatMutation = 'meal_created' | 'meal_updated' | 'meal_deleted' | 'goals_updated';

export interface ChatAction {
  tool: string;
  type?: ChatMutation;
  /** One line the UI can show as a record of what changed. */
  label: string;
  entryId?: string;
}
