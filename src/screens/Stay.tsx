import { useEffect, useRef, useState } from "react";
import { GUEST, MINIBAR, QUICK_REQUESTS, money, type ShopItem } from "../data";
import { useBooking, nextId } from "../store";
import { useHotel } from "../hotel/hotelStore";
import { Icon } from "../components/Icon";

let hkSeq = 2276;

export function Stay() {
  const { state, dispatch, addCharge, billTotal } = useBooking();
  const hotel = useHotel();
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [used, setUsed] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const room = state.assigned ?? GUEST.room;

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    dispatch({
      type: "PUSH_CHAT",
      msg: {
        id: nextId(),
        from: "desk",
        text: `ยินดีต้อนรับครับคุณ${GUEST.first} 🙏 ห้อง ${room} พร้อมแล้ว — แอร์เปิดรอไว้ที่ 24° · ขอของหรือแจ้งอะไรพิมพ์ในแชตนี้ได้เลยครับ`,
      },
    });
  }, [dispatch, room]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
  }, [state.chat, typing, state.jobs]);

  const deskReply = (text: string, job?: string) => {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      dispatch({ type: "PUSH_CHAT", msg: { id: nextId(), from: "desk", text } });
      hotel.dispatch({
        type: "INGEST",
        channel: "web",
        externalId: "guest-" + (state.bookingNo ?? GUEST.room),
        text,
        direction: "out",
        guest: GUEST.name,
        sentBy: "เคาน์เตอร์",
      });
      if (job) dispatch({ type: "ADD_JOB", job: { id: "HK-" + ++hkSeq, label: job } });
    }, 1050);
  };

  const request = (r: (typeof QUICK_REQUESTS)[number]) => {
    setUsed((u) => [...u, r.id]);
    dispatch({ type: "PUSH_CHAT", msg: { id: nextId(), from: "guest", text: r.text } });
    deskReply("รับทราบครับ — ส่งงานให้แม่บ้านแล้ว ถึงห้องภายใน 10 นาที", r.job);
  };

  const buy = (item: ShopItem) => {
    addCharge({
      label: item.label,
      note: `${item.note} ${money(item.price)}`,
      price: item.price,
      kind: "fnb",
    });
    dispatch({
      type: "PUSH_CHAT",
      msg: { id: nextId(), from: "guest", text: `ขอ${item.label} 1 ที่ครับ` },
    });
    deskReply(
      `ได้เลยครับ — ${item.label} ${money(item.price)} เข้าบิลห้อง ${room} อัตโนมัติแล้ว ดูยอดสะสมได้ที่แถบด้านบนตลอดเวลา`,
    );
  };

  const sendDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    dispatch({ type: "PUSH_CHAT", msg: { id: nextId(), from: "guest", text } });
    // ข้อความเดียวกันเข้ากล่องรวมของเคาน์เตอร์ด้วย — พนักงานเห็นทันทีโดยไม่ต้องบอก
    hotel.dispatch({
      type: "INGEST",
      channel: "web",
      externalId: "guest-" + (state.bookingNo ?? GUEST.room),
      text,
      guest: GUEST.name,
      bookingId: state.bookingNo ?? undefined,
    });
    deskReply("รับเรื่องแล้วครับ เดี๋ยวทีมงานดูแลให้ทันที 🙏");
  };

  return (
    <>
      <header className="appbar">
        <div className="brand">
          <span className="k">ห้อง {room} · กำลังเข้าพัก</span>
          <strong>{GUEST.name}</strong>
        </div>
        <button
          className="iconbtn"
          aria-label="เช็กเอาท์"
          onClick={() => dispatch({ type: "GOTO", step: "checkout" })}
        >
          <Icon name="key" size={17} />
        </button>
      </header>

      <div className="billtab">
        <Icon name="receipt" size={22} />
        <div>
          <span className="k">บิลห้อง {room} · ยอดสะสม</span>
          <small>มินิบาร์ · ร้านอาหาร · ซักรีด เข้าบิลอัตโนมัติ</small>
        </div>
        <span className="amt">{money(billTotal)}</span>
      </div>

      <div className="body" ref={scrollRef} style={{ gap: 9 }}>
        <div className="chat">
          {state.chat.map((m) => (
            <div key={m.id} className={`msg ${m.from}`}>
              <span className="who">{m.from === "desk" ? "โรงแรม" : GUEST.first}</span>
              {m.text}
            </div>
          ))}
          {state.jobs.map((j) => (
            <div key={j.id} className="jobcard">
              <Icon name="check" size={16} className="ic" />
              <span>
                <strong>งาน {j.id}</strong> · {j.label} — ส่งถึงแม่บ้านแล้ว
              </span>
            </div>
          ))}
          {typing && (
            <div className="typing">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>

        <div className="seclabel k">แจ้งเรื่องด่วน</div>
        <div className="quicks">
          {QUICK_REQUESTS.filter((r) => !used.includes(r.id)).map((r) => (
            <button key={r.id} className="quick" onClick={() => request(r)}>
              {r.text}
            </button>
          ))}
        </div>

        <div className="seclabel k">สั่งเข้าห้อง · เข้าบิลอัตโนมัติ</div>
        <div className="shop">
          {MINIBAR.map((item) => (
            <button key={item.id} className="shopitem" onClick={() => buy(item)}>
              <strong>{item.label}</strong>
              <span>{item.note}</span>
              <span className="p">
                {money(item.price)}
                <Icon name="plus" size={16} className="plus" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="composer">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendDraft()}
          placeholder="พิมพ์ข้อความ…"
        />
        <button className="sendbtn" onClick={sendDraft} aria-label="ส่ง">
          <Icon name="send" size={19} />
        </button>
      </div>
    </>
  );
}
