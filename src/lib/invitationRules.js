export function validateInvitation({ senderId, receiverId, participants, teams, invitations, challenge }) {
  if (senderId === receiverId) return 'You cannot invite yourself.';
  if (!participants.includes(receiverId)) return 'Only challenge participants can be invited.';
  if (teams.some(t => t.challengeId === challenge.id && t.members.includes(receiverId))) return 'This participant is already on a team.';
  if (teams.some(t => t.challengeId === challenge.id && t.members.includes(senderId) && t.members.length >= challenge.teamSize)) return 'Your team is full.';
  if (invitations.some(i => i.challengeId === challenge.id && i.senderId === senderId && i.receiverId === receiverId && i.status === 'Pending')) return 'A pending invite already exists.';
  return null;
}
