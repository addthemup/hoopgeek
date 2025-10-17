// Type declarations for JSON imports
declare module '*.json' {
  const value: any;
  export default value;
}

// Specific type for games-index.json
declare module '../assets/json/games-index.json' {
  import { GameData } from '../../utils/gameLoader';
  const games: GameData[];
  export default games;
}

