// Update an individual live activity in place, keeping the original order of tool calls.
export function updateToolMessages(messages, event) {
  if (event.type === 'tool_start') return [...messages, {role:'tool_start',toolId:event.toolId,toolName:event.toolName,toolComment:event.toolComment,command:event.command,toolStatus:'running',text:''}];
  if (event.type === 'tool_finish') return messages.map(item => item.toolId === event.toolId ? {...item,text:event.text,toolStatus:event.toolStatus} : item);
  return messages;
}
