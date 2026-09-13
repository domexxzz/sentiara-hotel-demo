/* หน้าตาของ `ledger-engine.mjs` สำหรับ TypeScript
 *
 * ไฟล์ .mjs ที่ประกอบมาไม่มีชนิดข้อมูลติดมาด้วย · ไฟล์นี้จึงประกาศไว้ให้
 * **ประกาศเท่าที่จอบัญชีใช้จริงเท่านั้น** ไม่ลอกชนิดทั้งชุดของ Ledger Bridge มา
 * เพราะการลอกมาคือการสร้างสำเนาที่ต้องตามแก้ทุกครั้งที่เขาเปลี่ยน
 * ถ้าเขาเพิ่มฟิลด์ใหม่แล้วเราไม่รู้ อย่างมากคือเราไม่ได้ใช้ ไม่ใช่เราแสดงผิด
 */
declare module "*/ledger-engine.mjs" {
  /** หนึ่งบรรทัดในใบสำคัญ — ด้าน D คือเดบิต C คือเครดิต */
  export interface Posting {
    side: "D" | "C";
    account: string;
    name: string;
    /** เงินเป็นสตริงเสมอ เช่น "1886.92" — ห้ามแปลงเป็น number ไปคำนวณต่อ */
    amount: string;
  }

  export interface PostingOk {
    ok: true;
    postings: Posting[];
    debit: string;
    credit: string;
  }

  export interface PostingFail {
    ok: false;
    /** เช่น NO_RULE · MISSING_FIELD · MONEY_MUST_BE_STRING · UNBALANCED */
    code: string;
    message: string;
  }

  export type PostingResult = PostingOk | PostingFail;

  /** กฎที่ตั้งไว้แล้วฝั่ง Ledger Bridge · docType ที่ไม่อยู่ในนี้จะได้ NO_RULE */
  export const RULES: { docType: string; name: string; version: number; lineCount: number }[];

  /** ผังบัญชี · side คือด้านปกติของบัญชีนั้น */
  export const CHART: { code: string; name: string; side: "D" | "C" }[];

  /** ยิงเอกสารหนึ่งใบผ่านกฎจริง · ไม่โยน error ตอบเป็นผลลัพธ์เสมอ */
  export function evaluate(docType: string, doc: unknown): PostingResult;
}
