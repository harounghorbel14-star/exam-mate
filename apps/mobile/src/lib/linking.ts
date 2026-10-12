/** Invite links: exammate://play/ABC234 opens the online room directly; exammate://arcade/<id> opens a game. */
export const linking = {
  prefixes: ['exammate://'],
  config: { screens: { PlayOnline: 'play/:code', ArcadePlay: 'arcade/:id' } },
};
