import { MENU, type Ingredient, type MenuItem } from "./posData";

export const menuOf = (id: string) => MENU.find((m) => m.id === id) as MenuItem;

/** เมนูขายไม่ได้เมื่อวัตถุดิบในสูตรตัวใดตัวหนึ่งไม่พอ */
export const isSoldOut = (menu: MenuItem, stock: Ingredient[]) =>
  menu.recipe.some((recipe) => {
    const ingredient = stock.find((item) => item.id === recipe.ing);
    return !ingredient || ingredient.qty < recipe.use;
  });
