let guestSequence = 0;

/** รหัสชั่วคราวของข้อความ/งานฝั่งแขกในหนึ่ง session */
export const nextGuestId = () => "g" + ++guestSequence;
