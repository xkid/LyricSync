
export interface LyricLine {
  time: number;
  text: string;
  romanization: string;
  translation: string;
}

export interface SongData {
  title: string;
  artist: string;
  lyrics: LyricLine[];
}

export enum PlayerState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  ERROR = 'ERROR'
}
