import { useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import {
  authorize,
  DEMO,
  DEVICE_LIMIT,
  fmtMb,
  fmtTime,
  GRACE_HOURS,
  identityOf,
  makeSecret,
  MIN_RETENTION_DAYS,
  NOW,
  onlineNow,
  setRetention,
  type AuthNo,
  type AuthOk,
  type WifiState,
} from "../lib/wifi";

/**
 * Wi-Fi ที่พัก
 *
 * จอนี้ไม่ได้มีไว้ดูความเร็วเน็ตหรือกราฟการใช้งาน — ของพวกนั้นอุปกรณ์เครือข่าย
 * ทำได้ดีกว่าและถูกกว่าอยู่แล้ว · จอนี้มีไว้ตอบคำถามเดียวที่อุปกรณ์ตอบไม่ได้
 * และเป็นคำถามที่เจ้าหน้าที่ถามจริงเวลามีเรื่อง:
 *
 *     "วันนั้น เวลานั้น IP นี้ คือใคร"
 *
 * ม.26 พ.ร.บ.คอมพิวเตอร์ ให้เก็บข้อมูลจราจรไม่น้อยกว่า 90 วัน · ข้อมูลจราจร
 * ที่โยงกลับไปหาคนไม่ได้ ไม่ช่วยอะไรตอนถูกถาม — ชิ้นที่หายไปคือทะเบียนผู้พัก
 * ซึ่งอยู่ในระบบนี้อยู่แล้ว
 */
export function Wifi() {
  const [state, setState] = useState<WifiState>(() => structuredClone(DEMO));
  const [shown, setShown] = useState<Record<string, string>>({});
  const [probe, setProbe] = useState({ room: "402", secret: "kq7n3x", mac: "9c:2f:4e:11:07:b3" });
  const [verdict, setVerdict] = useState<AuthOk | AuthNo | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [days, setDays] = useState(String(MIN_RETENTION_DAYS));
  const [keepMsg, setKeepMsg] = useState<string | null>(null);

  const live = onlineNow(state);
  const id = useMemo(() => (picked ? identityOf(state, picked) : null), [state, picked]);

  const issue = (ref: string) => {
    const secret = makeSecret();
    setState((s) => ({
      ...s,
      creds: s.creds.map((c) => (c.ref === ref ? { ...c, secret, revoked: false } : c)),
    }));
    // แสดงครั้งเดียวเหมือนของจริง — ระบบเก็บแต่ค่าที่ผ่านการแฮช ย้อนดูทีหลังไม่ได้
    setShown((m) => ({ ...m, [ref]: secret }));
  };

  const revoke = (ref: string) => {
    setState((s) => ({
      ...s,
      creds: s.creds.map((c) => (c.ref === ref ? { ...c, revoked: true } : c)),
      sessions: s.sessions.map((x) =>
        x.room === s.creds.find((c) => c.ref === ref)?.room && !x.endedAt ? { ...x, endedAt: NOW } : x,
      ),
    }));
    setShown((m) => {
      const next = { ...m };
      delete next[ref];
      return next;
    });
  };

  return (
    <div className="wf">
      <div className="deskhead">
        <div>
          <span className="k">Wi-Fi ที่พัก · ม.26 พ.ร.บ.คอมพิวเตอร์</span>
          <h2>ตอบได้ว่า “IP นี้คือใคร” ไม่ใช่แค่ “MAC นี้ทำอะไร”</h2>
        </div>
        <span className="n">เก็บข้อมูล {state.retentionDays} วัน</span>
      </div>

      <div className="wf-split">
        <div>
          <span className="k">อุปกรณ์เครือข่ายรู้</span>
          <b>MAC นี้ทำอะไร</b>
          <span className="sub">เข้าเว็บไหน เมื่อไร ปริมาณเท่าไร — เก็บได้ดีอยู่แล้ว ระบบนี้ไม่แย่งงาน</span>
        </div>
        <div className="mid">+</div>
        <div>
          <span className="k">ระบบนี้รู้</span>
          <b>MAC นี้คือใคร</b>
          <span className="sub">ชื่อตามเอกสาร สัญชาติ เลขพาสปอร์ต ห้อง วันเข้าออก</span>
        </div>
      </div>

      {/* ══ รหัสรายห้อง ══════════════════════════════════════════ */}
      <section className="wf-sec">
        <h3>รหัสรายห้อง</h3>
        <p className="wf-why">
          ชื่อผู้ใช้คือเลขห้อง รหัสสุ่มรายห้อง · ออกอัตโนมัติตอนเช็กอิน และหมดอายุเองหลังเช็กเอาต์
          บวกผ่อนผัน {GRACE_HOURS} ชั่วโมง — แขกยังยืนรอแท็กซี่อยู่ที่ล็อบบี้
        </p>
        <div className="wf-creds">
          {state.creds.map((c) => {
            const devices = live.filter((s) => s.room === c.room).length;
            const expired = new Date(NOW) > new Date(c.validUntil);
            return (
              <div key={c.ref} className={c.revoked || expired ? "off" : ""}>
                <div className="row1">
                  <b>ห้อง {c.room}</b>
                  <span className="who">{c.guest}</span>
                  <span className={`st ${c.revoked ? "no" : expired ? "old" : "on"}`}>
                    {c.revoked ? "ตัดสิทธิ์แล้ว" : expired ? "หมดอายุแล้ว" : `ต่ออยู่ ${devices}/${c.limit} เครื่อง`}
                  </span>
                </div>
                <span className="until">ใช้ได้ถึง {fmtTime(c.validUntil)}</span>
                {shown[c.ref] ? (
                  <p className="wf-secret">
                    <span>รหัสใหม่</span>
                    <code>{shown[c.ref]}</code>
                    <em>แสดงครั้งเดียว — ระบบเก็บแต่ค่าที่ผ่านการแฮช ย้อนดูทีหลังไม่ได้</em>
                  </p>
                ) : null}
                <div className="wf-act">
                  <button className="btn ghost" onClick={() => issue(c.ref)}>
                    ออกรหัสใหม่
                  </button>
                  <button className="btn ghost" disabled={c.revoked} onClick={() => revoke(c.ref)}>
                    ตัดสิทธิ์ทันที
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ══ ลองเป็นอุปกรณ์ ═══════════════════════════════════════ */}
      <section className="wf-sec">
        <h3>ลองเป็นอุปกรณ์ที่ขอต่อเน็ต</h3>
        <p className="wf-why">
          นี่คือคำถามที่ตัวกระจายสัญญาณยิงเข้ามาจริงทุกครั้งที่มีคนกดเชื่อมต่อ
          (ผ่าน RADIUS หรือ captive portal มาตรฐาน — ใช้กับ Mikrotik · UniFi · Ruckus · Aruba · Cisco ได้หมด)
        </p>
        <div className="wf-probe">
          <label>
            ห้อง
            <input value={probe.room} onChange={(e) => setProbe({ ...probe, room: e.target.value })} />
          </label>
          <label>
            รหัส
            <input value={probe.secret} onChange={(e) => setProbe({ ...probe, secret: e.target.value })} />
          </label>
          <label>
            MAC ของเครื่อง
            <input value={probe.mac} onChange={(e) => setProbe({ ...probe, mac: e.target.value })} />
          </label>
          <button className="btn primary" onClick={() => setVerdict(authorize(state, probe))}>
            ถามระบบ
          </button>
        </div>
        <div className="wf-quick">
          <span>ลองกรณีที่เจอบ่อย:</span>
          <button
            onClick={() => {
              const p = { room: "402", secret: "kq7n3x", mac: "9c:2f:4e:11:07:b3" };
              setProbe(p);
              setVerdict(authorize(state, p));
            }}
          >
            เครื่องที่สามของห้อง 402
          </button>
          <button
            onClick={() => {
              // ห้อง 207 มีสองเครื่องแล้ว + เครื่องนี้ = สาม ยังไม่เกิน จึงต้องยิงห้อง 402 ให้ครบก่อน
              const p = { room: "402", secret: "kq7n3x", mac: "aa:bb:cc:dd:ee:01" };
              setProbe(p);
              setVerdict(authorize({ ...state, sessions: [...state.sessions,
                { id: "tmp", room: "402", mac: "9c:2f:4e:11:07:b3", ip: "10.24.7.120",
                  nas: "AP-ชั้น4-ทางเดิน", startedAt: NOW, endedAt: null, mb: 0 }] }, p));
            }}
          >
            เครื่องที่สี่ — เกินโควตา
          </button>
          <button
            onClick={() => {
              const p = { room: "402", secret: "wrong1", mac: "9c:2f:4e:11:07:b3" };
              setProbe(p);
              setVerdict(authorize(state, p));
            }}
          >
            รหัสผิด
          </button>
          <button
            onClick={() => {
              const p = { room: "508", secret: "t6bmxy", mac: "9c:2f:4e:11:07:b3" };
              setProbe(p);
              setVerdict(authorize(state, p));
            }}
          >
            แขกที่เช็กเอาต์ไปแล้ว
          </button>
        </div>
        {verdict && (
          <div className={`wf-verdict ${verdict.ok ? "yes" : "no"}`}>
            <Icon name={verdict.ok ? "sparkle" : "shield"} size={17} className="ic" />
            {verdict.ok ? (
              <div>
                <b>อนุญาตให้ต่อ</b>
                <span>
                  ห้อง {verdict.room} · {verdict.guest} · การจอง {verdict.ref} ·
                  กำลังต่ออยู่ {verdict.devicesOnline}/{verdict.limit} เครื่อง
                </span>
              </div>
            ) : (
              <div>
                <b>ปฏิเสธ</b>
                <span>{verdict.reason}</span>
              </div>
            )}
          </div>
        )}
        <p className="wf-note">
          ข้อความปฏิเสธเรื่องรหัสเหมือนกันทุกกรณีโดยตั้งใจ — ใครยืนที่ล็อบบี้แล้วลองสุ่มเลขห้อง
          ต้องไม่ได้ข้อมูลกลับไปว่าห้องไหนมีแขกอยู่จริง
        </p>
      </section>

      {/* ══ เจ้าหน้าที่ขอข้อมูล ══════════════════════════════════ */}
      <section className="wf-sec">
        <h3>เมื่อเจ้าหน้าที่ขอข้อมูล</h3>
        <p className="wf-why">
          คำขอมาเป็นหมายเลข IP กับเวลา ไม่ได้มาเป็นชื่อคน — กดเลือก session แล้วดูว่าตอบได้แค่ไหน
        </p>
        <div className="wf-table">
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>IP</th>
                <th>เครื่อง</th>
                <th>จุดกระจายสัญญาณ</th>
                <th>เริ่มเมื่อ</th>
                <th className="num">ข้อมูล</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.sessions.map((s) => (
                <tr key={s.id} className={picked === s.id ? "on" : ""}>
                  <td>{s.room}</td>
                  <td><code>{s.ip}</code></td>
                  <td><code>{s.mac}</code></td>
                  <td>{s.nas}</td>
                  <td>
                    {fmtTime(s.startedAt)}
                    {!s.endedAt && <span className="livedot"> ต่ออยู่</span>}
                  </td>
                  <td className="num">{fmtMb(s.mb)}</td>
                  <td>
                    <button className="btn ghost" onClick={() => setPicked(s.id)}>
                      ใครใช้
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {id && (
          <div className="wf-id">
            <span className="k">
              คำตอบสำหรับ {id.session.ip} เมื่อ {fmtTime(id.session.startedAt)}
            </span>
            <dl>
              <div>
                <dt>ห้อง · การจอง</dt>
                <dd>
                  {id.cred.room} · {id.cred.ref}
                </dd>
              </div>
              <div>
                <dt>ช่วงเข้าพัก</dt>
                <dd>
                  {fmtTime(id.cred.validFrom)} — {fmtTime(id.cred.validUntil)}
                </dd>
              </div>
              <div>
                <dt>ผู้พักในห้องนั้น</dt>
                <dd>
                  {id.occupants.map((o) => (
                    <span key={o.doc} className="occ">
                      <b>{o.name}</b> · {o.nationality} · {o.doc}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
            <p className={`wf-keep ${id.withinRetention ? "" : "gone"}`}>
              {id.withinRetention
                ? `เก็บมาแล้ว ${id.daysKept} วัน · ยังอยู่ในช่วงที่กฎหมายบังคับให้เก็บ (${state.retentionDays} วัน) จึงยังตอบได้`
                : `เก็บมาแล้ว ${id.daysKept} วัน · เกินช่วงเก็บแล้ว`}
            </p>
            <p className="wf-note">
              คืน<strong>ผู้พักทุกคนในห้อง</strong> ไม่ใช่คนเดียว — รหัสผูกกับห้อง
              การเดาว่าเป็นคนแรกในทะเบียนคือการชี้ตัวคนที่อาจไม่ได้ถือเครื่องนั้น
            </p>
          </div>
        )}
      </section>

      {/* ══ เวลาเก็บ ═════════════════════════════════════════════ */}
      <section className="wf-sec">
        <h3>เวลาเก็บข้อมูลจราจร</h3>
        <div className="wf-keeprow">
          <label>
            เก็บไว้ (วัน)
            <input
              value={days}
              inputMode="numeric"
              onChange={(e) => {
                setDays(e.target.value);
                setKeepMsg(null);
              }}
            />
          </label>
          <button
            className="btn primary"
            onClick={() => {
              const n = Number(days);
              const r = setRetention(n);
              if (r.ok) {
                setState((s) => ({ ...s, retentionDays: n }));
                setKeepMsg(`ตั้งเป็น ${n} วันแล้ว`);
              } else {
                setKeepMsg(r.reason!);
              }
            }}
          >
            บันทึก
          </button>
          <span className="hint">ลองใส่ 30 ดู</span>
        </div>
        {keepMsg && (
          <div className={`wf-verdict ${keepMsg.startsWith("ตั้งเป็น") ? "yes" : "no"}`}>
            <Icon name="shield" size={17} className="ic" />
            <div>
              <span>{keepMsg}</span>
            </div>
          </div>
        )}
        <p className="wf-note">
          ตัวกันนี้มีเพราะการตั้งค่าผิดจะทำให้ผิดกฎหมาย<strong>เงียบ ๆ</strong> ไม่มีอะไรฟ้อง
          จนกว่าเจ้าหน้าที่จะมาขอแล้วเราไม่มีให้ · หลังบ้านปฏิเสธค่าต่ำกว่า {MIN_RETENTION_DAYS} วัน
          ด้วยกติกาเดียวกันนี้ ({DEVICE_LIMIT} เครื่องต่อห้องก็ตั้งที่เดียวกัน)
        </p>
      </section>
    </div>
  );
}
