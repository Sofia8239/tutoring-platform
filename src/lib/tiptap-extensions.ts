import { StarterKit } from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";

/**
 * The single extension set for page content. Shared by the client editor
 * (`@tiptap/react`) and the server-side renderer (`@tiptap/static-renderer`) so
 * a document round-trips identically. These extensions are DOM-free at import,
 * so this module is safe in a Server Component.
 */
export const pageExtensions = [
  StarterKit,
  TableKit.configure({ table: { resizable: true } }),
  TaskList,
  TaskItem.configure({ nested: true }),
];
