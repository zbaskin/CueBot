export type ShowtimeStatus = 'available' | 'almostSoldOut' | 'soldOut' | 'notOnSale';

export interface Showtime {
  showtimeId: string;
  movieTitle: string;
  date: string;       // YYYY-MM-DD
  time: string;       // e.g. "7:00pm"
  format: string;     // e.g. "IMAX", "Dolby", "Standard"
  status: ShowtimeStatus;
  url: string;
}

export interface TheaterSchedule {
  theaterId: string;
  theaterName: string;
  fetchedAt: string;  // ISO timestamp
  showtimes: Showtime[];
}
