export type BookingStatus = 'confirmed' | 'cancelled';

export type Booking = {
  id: string;
  roomId: string;
  title: string;
  organizerEmail: string;
  startTime: string; // ISO-8601 (UTC)
  endTime: string; // ISO-8601 (UTC)
  status: BookingStatus;
};

