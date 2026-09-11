import { useState } from "react";
import type { ChatChannel } from "../hotel/hotelStore";
import { useDesk, useHotel } from "../contexts";
import { money } from "../lib/format";
import { fmtRange } from "../lib/date";
import { Icon, type IconName } from "../components/Icon";

/** ป้ายช่องทาง — ช่องทางเป็นแค่คุณสมบัติของห้องแชต ไม่ใช่ตัวตนของมัน */
const CH: Record<ChatChannel, { label: string; icon: IconName; cls: string }> = {
  web: { label: "เว็บจองตรง", icon: "chat", cls: "web" },
  line: { label: "LINE", icon: "line", cls: "line" },
  booking: { label: "Booking.com", icon: "tag", cls: "ota" },
  airbnb: { label: "Airbnb", icon: "tag", cls: "ota" },
  agoda: { label: "Agoda", icon: "tag", cls: "ota" },
  walkin: { label: "หน้าเคาน์เตอร์", icon: "users", cls: "web" },
};

const GATE_NAME = [
  "",
  "ด่าน 1 · เรื่องที่บอทไม่ตอบเอง",
  "ด่าน 2 · หน้าต่างเวลา",
  "ด่าน 3 · ดึงข้อมูลจริงไม่สำเร็จ",
  "ด่าน 4 · คำตอบไม่ตรงกับระบบ",
];

export function Inbox() {
  const { dispatch } = useDesk();
  const hotel = useHotel();
  const [active, setActive] = useState<string | null>(
    hotel.state.conversations[0]?.id ?? null,
  );
  const [draft, setDraft] = useState("");

  const conv = hotel.state.conversations.find((c) => c.id === active);
  const msgs = active ? hotel.msgsOf(active) : [];
  const booking = conv?.bookingId
    ? hotel.state.bookings.find((b) => b.id === conv.bookingId)
    : undefined;

  const open = (id: string) => {
    setActive(id);
    hotel.dispatch({ type: "READ_CONV", convId: id });
  };

  /** ลูกค้าทักเข้ามา → ให้บอทลองตอบ → ผ่านด่านทั้งสี่ก่อนถึงตาลูกค้า */
  const incoming = (text: string, wrong?: "price" | "promise" | "stale") => {
    if (!conv) return;
    hotel.dispatch({
      type: "INGEST",
      channel: conv.channel,
      externalId: conv.externalId,
      text,
      guest: conv.guest,
    });
    const verdict = hotel.botReply(conv.id, text, wrong);
    if (verdict.send) {
      hotel.dispatch({
        type: "INGEST",
        channel: conv.channel,
        externalId: conv.externalId,
        text: verdict.text,
        direction: "out",
        sentBy: "bot",
      });
      hotel.dispatch({ type: "CLEAR_HANDOVER", convId: conv.id });
    } else {
      hotel.dispatch({
        type: "HANDOVER",
        convId: conv.id,
        gate: verdict.gate ?? 0,
        reason: verdict.reason ?? "",
        detail: verdict.detail ?? "",
        draft: verdict.text,
      });
    }
  };

  const reply = () => {
    if (!conv || !draft.trim()) return;
    hotel.dispatch({
      type: "INGEST",
      channel: conv.channel,
      externalId: conv.externalId,
      text: draft.trim(),
      direction: "out",
      sentBy: "สมชาย",
    });
    hotel.dispatch({ type: "CLEAR_HANDOVER", convId: conv.id });
    dispatch({ type: "TOAST", text: `ตอบ ${conv.guest} ทาง ${CH[conv.channel].label} แล้ว` });
    setDraft("");
  };

  const lastIn = msgs.filter((m) => m.direction === "in").at(-1)?.text ?? "";
  const facts = conv ? hotel.factsFor(lastIn) : null;

  return (
    <>
      <div className="deskhead">
        <div>
          <span className="k">กล่องข้อความรวม · ทุกช่องทางที่เดียว</span>
          <h2>
            {hotel.state.conversations.length} คู่สนทนา
            {hotel.unreadChats > 0 && ` · ยังไม่ได้อ่าน ${hotel.unreadChats}`}
          </h2>
        </div>
      </div>

      <p className="lead">
        แขกทัก LINE · Booking.com · Airbnb หรือหน้าเว็บ มาลงที่จอเดียว —
        พนักงานไม่ต้องเปิดหกแอป และบอทตอบได้เฉพาะเรื่องที่ตรวจกับระบบจริงแล้วเท่านั้น
      </p>

      <div className="ib">
        <div className="ib-list">
          {hotel.state.conversations.map((c) => (
            <button
              key={c.id}
              className={`ib-row ${c.id === active ? "on" : ""}`}
              onClick={() => open(c.id)}
            >
              <span className={`ib-ch ${CH[c.channel].cls}`}>
                <Icon name={CH[c.channel].icon} size={13} />
              </span>
              <span className="who">
                <strong>{c.guest}</strong>
                <span className="last">{c.lastText || "—"}</span>
              </span>
              <span className="meta">
                <span className="t">{c.lastAt}</span>
                {c.unread > 0 && <span className="dot">{c.unread}</span>}
                {c.handover && <span className="hd">รอคน</span>}
              </span>
            </button>
          ))}
        </div>

        <div className="ib-thread">
          {!conv ? (
            <p className="lead">เลือกคู่สนทนาทางซ้าย</p>
          ) : (
            <>
              <div className="ib-top">
                <div>
                  <strong>{conv.guest}</strong>
                  <span>
                    {CH[conv.channel].label} · {conv.externalId}
                    {booking &&
                      ` · ห้อง ${booking.room ?? "—"} · ${fmtRange(booking.checkIn, booking.checkOut)}`}
                  </span>
                </div>
              </div>

              <div className="ib-msgs">
                {msgs.map((m) => (
                  <div key={m.id} className={`ib-msg ${m.direction}`}>
                    <span className="bub">{m.text}</span>
                    <span className="by">
                      {m.at}
                      {m.sentBy === "bot" ? " · บอท" : m.sentBy ? ` · ${m.sentBy}` : ""}
                    </span>
                  </div>
                ))}
              </div>

              {conv.handover && (
                <div className="ib-block">
                  <div className="hdr">
                    <Icon name="shield" size={15} />
                    <strong>{GATE_NAME[conv.handover.gate] ?? "ส่งต่อให้คน"}</strong>
                    <span className="why">{conv.handover.reason}</span>
                  </div>
                  <p>{conv.handover.detail}</p>
                  <div className="drafted">
                    <span className="k">คำตอบที่บอทร่างไว้ · ไม่ได้ส่งออก</span>
                    “{conv.handover.draft}”
                  </div>
                  <button
                    className="btn ghost sm"
                    onClick={() => setDraft(conv.handover?.draft ?? "")}
                  >
                    เอาร่างมาแก้เอง
                  </button>
                </div>
              )}

              <div className="ib-facts">
                <span className="k">ข้อเท็จจริงที่บอทอ้างอิงได้รอบนี้</span>
                {facts && facts.available !== null ? (
                  <span>
                    ห้องว่าง{facts.range ? " " + facts.range : ""} <b>{facts.available} ห้อง</b> ·
                    เรตที่พูดได้ <b>{facts.figures.map((f) => money(f)).join(" · ")}</b> —
                    ดึงสดจากปฏิทินเดียวกับเคาน์เตอร์
                  </span>
                ) : (
                  <span>ว่างเปล่า — รอบนี้บอทพูดตัวเลขใด ๆ ไม่ได้เลย</span>
                )}
              </div>

              <div className="ib-send">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`ตอบ ${conv.guest} ทาง ${CH[conv.channel].label}…`}
                  onKeyDown={(e) => e.key === "Enter" && reply()}
                />
                <button className="btn primary" onClick={reply} disabled={!draft.trim()}>
                  <Icon name="send" size={15} />
                  ส่ง
                </button>
              </div>

              <div className="ib-try">
                <span className="k">ลองยิงข้อความเข้ามาเพื่อดูด่านทำงาน</span>
                <div>
                  <button
                    className="btn ghost sm"
                    onClick={() => incoming("คืนนี้มีห้องว่างไหมครับ ราคาเท่าไร")}
                  >
                    ถามห้องว่าง · บอทตอบเองได้
                  </button>
                  <button className="btn ghost sm" onClick={() => incoming("ลดราคาหน่อยได้ไหมครับ")}>
                    ต่อรองราคา · ติดด่าน 1
                  </button>
                  <button
                    className="btn ghost sm accent"
                    onClick={() => incoming("คืนนี้ว่างไหมครับ ราคาเท่าไร", "price")}
                  >
                    บอทแต่งราคาเอง · ด่าน 4
                  </button>
                  <button
                    className="btn ghost sm accent"
                    onClick={() => incoming("ห้องมีวิวสระว่ายน้ำไหมครับ ราคาห้องเท่าไร", "promise")}
                  >
                    บอทรับปากเอง · ด่าน 4
                  </button>
                  <button
                    className="btn ghost sm accent"
                    onClick={() => incoming("คืนนี้ยังพอมีห้องว่างไหมครับ ราคาห้องเท่าไหร่", "stale")}
                  >
                    บอทบอกเต็มทั้งที่ว่าง · ด่าน 4
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
