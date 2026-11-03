// "My shelf": product picks for every routine step, in 3 price levels.
// Prices are approximate US retail (late 2026) and only a guide. Check them, and have a
// cosmetologist review the list, before running ads. Links open a store search (see config.js).

export const TIERS = [
  { id: "budget", label: "Budget" },
  { id: "mid", label: "Mid" },
  { id: "premium", label: "Premium" },
];

// key = routine block id from plans.js
export const SHELF = {
  cleanse_am: {
    what: "Gentle, fragrance-free cleanser",
    budget: { name: "Vanicream Gentle Facial Cleanser", price: 10 },
    mid: { name: "CeraVe Hydrating Facial Cleanser", price: 16 },
    premium: { name: "La Roche-Posay Toleriane Hydrating Gentle Cleanser", price: 19 },
  },
  spf: {
    what: "Broad-spectrum SPF 30+",
    budget: { name: "Neutrogena Ultra Sheer Dry-Touch SPF 55", price: 11 },
    mid: { name: "La Roche-Posay Anthelios Melt-in Milk SPF 60", price: 37 },
    premium: { name: "EltaMD UV Clear SPF 46", price: 43 },
  },
  moisturizer: {
    what: "Light daily moisturizer",
    budget: { name: "Vanicream Daily Facial Moisturizer", price: 15 },
    mid: { name: "La Roche-Posay Toleriane Double Repair Moisturizer", price: 24 },
    premium: { name: "Clinique Moisture Surge 100H", price: 45 },
  },
  gel_moisturizer: {
    what: "Oil-free gel moisturizer",
    budget: { name: "The Ordinary Natural Moisturizing Factors + HA", price: 9 },
    mid: { name: "Neutrogena Hydro Boost Water Gel", price: 22 },
    premium: { name: "Clinique Dramatically Different Hydrating Jelly", price: 32 },
  },
  eye_care: {
    what: "Caffeine eye serum or cream",
    budget: { name: "The Ordinary Caffeine Solution 5% + EGCG", price: 10 },
    mid: { name: "CeraVe Eye Repair Cream", price: 17 },
    premium: { name: "Clinique All About Eyes", price: 38 },
  },
  cleanse_pm: {
    what: "Makeup / SPF remover",
    budget: { name: "Garnier Micellar Cleansing Water", price: 9 },
    mid: { name: "Bioderma Sensibio H2O", price: 17 },
    premium: { name: "Clinique Take The Day Off Cleansing Balm", price: 38 },
  },
  hydrate: {
    what: "Hyaluronic acid serum",
    budget: { name: "The Ordinary Hyaluronic Acid 2% + B5", price: 10 },
    mid: { name: "Vichy Minéral 89 Hyaluronic Acid Booster", price: 35 },
    premium: { name: "Drunk Elephant B-Hydra Intensive Hydration Serum", price: 52 },
  },
  exfoliate: {
    what: "Gentle AHA or BHA exfoliant",
    budget: { name: "The Ordinary Glycolic Acid 7% Exfoliating Toner", price: 13 },
    mid: { name: "Paula's Choice Skin Perfecting 2% BHA Liquid Exfoliant", price: 35 },
    premium: { name: "Drunk Elephant T.L.C. Framboos Glycolic Night Serum", price: 90 },
  },
  soothe: {
    what: "Calming niacinamide or centella",
    budget: { name: "The Ordinary Niacinamide 10% + Zinc 1%", price: 7 },
    mid: { name: "La Roche-Posay Cicaplast Baume B5", price: 17 },
    premium: { name: "SkinCeuticals Phyto Corrective Gel", price: 70 },
  },
  brow_serum: {
    what: "Brow serum (peptides)",
    budget: { name: "The Ordinary Multi-Peptide Lash and Brow Serum", price: 15 },
    mid: { name: "GrandeBROW Brow Enhancing Serum", price: 70 },
    premium: { name: "RevitaBrow Advanced Eyebrow Conditioner", price: 110 },
  },
  retinoid: {
    what: "Beginner retinol",
    budget: { name: "The Ordinary Retinol 0.2% in Squalane", price: 9 },
    mid: { name: "CeraVe Resurfacing Retinol Serum", price: 22 },
    premium: { name: "La Roche-Posay Retinol B3 Serum", price: 45 },
  },
  spot: {
    what: "Spot care",
    budget: { name: "Mighty Patch Original", price: 13 },
    mid: { name: "Mario Badescu Drying Lotion", price: 17 },
    premium: { name: "La Roche-Posay Effaclar Duo Acne Spot Treatment", price: 30 },
  },
  moist_pm: {
    what: "Richer night moisturizer",
    budget: { name: "CeraVe PM Facial Moisturizing Lotion", price: 17 },
    mid: { name: "Kiehl's Ultra Facial Cream", price: 38 },
    premium: { name: "Tatcha The Water Cream", price: 72 },
  },
};
