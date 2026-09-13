import { DEMO_PASSWORD_SHA256, DEMO_PASSWORD_SALT } from "../core/config.js";
import {
  ANALYTICS_EVENTS,
  COUPON_TYPE,
  ORDER_STATUS,
  PRODUCT_STATUS,
  REVIEW_STATUS,
  ROLES,
} from "../core/constants.js";
import { generateExtendedCatalog } from "./catalogGenerator.js";
import {
  analyticsRepository,
  categoryRepository,
  couponRepository,
  inventoryHistoryRepository,
  inventoryRepository,
  orderRepository,
  productRepository,
  reviewRepository,
  userRepository,
  variantRepository,
  getMeta,
  setMeta,
  atomic,
} from "./repositories.js";

export const SEED_VERSION = 5;

const DEMO_USERS = [
  {
    id: "user-customer",
    email: "customer@morrow.demo",
    name: "Avery Chen",
    role: ROLES.CUSTOMER,
  },
  {
    id: "user-support",
    email: "support@morrow.demo",
    name: "Jordan Blake",
    role: ROLES.SUPPORT_AGENT,
  },
  {
    id: "user-inventory",
    email: "inventory@morrow.demo",
    name: "Sam Okonkwo",
    role: ROLES.INVENTORY_MANAGER,
  },
  {
    id: "user-manager",
    email: "manager@morrow.demo",
    name: "Riley Nakamura",
    role: ROLES.STORE_MANAGER,
  },
  {
    id: "user-admin",
    email: "admin@morrow.demo",
    name: "Morgan Ellis",
    role: ROLES.ADMINISTRATOR,
  },
  {
    id: "user-super",
    email: "super@morrow.demo",
    name: "Quinn Morrow",
    role: ROLES.SUPER_ADMIN,
  },
];

const buildCategories = (products) => {
  const map = new Map();
  products.forEach((product) => {
    if (!map.has(product.category)) {
      map.set(product.category, {
        id: product.category.toLowerCase(),
        name: product.category,
        subcategories: new Set(),
      });
    }
    if (product.subcategory) map.get(product.category).subcategories.add(product.subcategory);
  });
  return [...map.values()].map((entry) => ({
    id: entry.id,
    name: entry.name,
    subcategories: [...entry.subcategories],
  }));
};

const buildInventory = (products) => {
  const records = [];
  const history = [];
  const now = new Date().toISOString();
  products.forEach((product) => {
    const reorderLevel = product.stock > 0 ? Math.max(2, Math.round(product.stock * 0.15)) : 2;
    records.push({
      id: `inv-${product.id}`,
      productId: product.id,
      variantId: null,
      sku: product.sku,
      onHand: product.stock,
      reserved: 0,
      reorderLevel,
    });
    history.push({
      id: `invh-${product.id}-seed`,
      inventoryId: `inv-${product.id}`,
      productId: product.id,
      variantId: null,
      action: "seed",
      delta: product.stock,
      previousOnHand: 0,
      newOnHand: product.stock,
      reason: "Initial catalog seed",
      actorId: "system",
      createdAt: now,
    });
  });
  return { records, history };
};

const buildCoupons = () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: "coupon-morrow10",
      code: "MORROW10",
      type: COUPON_TYPE.PERCENTAGE,
      value: 10,
      label: "Welcome offer",
      minimumOrder: 0,
      expiresAt: new Date(now + 365 * day).toISOString(),
      usageLimit: null,
      usageCount: 0,
      active: true,
      productIds: [],
      categories: [],
    },
    {
      id: "coupon-save25",
      code: "SAVE25",
      type: COUPON_TYPE.FIXED,
      value: 25,
      label: "$25 off $150",
      minimumOrder: 150,
      expiresAt: new Date(now + 180 * day).toISOString(),
      usageLimit: 500,
      usageCount: 12,
      active: true,
      productIds: [],
      categories: [],
    },
    {
      id: "coupon-home15",
      code: "HOME15",
      type: COUPON_TYPE.PERCENTAGE,
      value: 15,
      label: "Home collection",
      minimumOrder: 0,
      expiresAt: new Date(now + 90 * day).toISOString(),
      usageLimit: 200,
      usageCount: 4,
      active: true,
      productIds: [],
      categories: ["Home"],
    },
    {
      id: "coupon-expired",
      code: "EXPIRED10",
      type: COUPON_TYPE.PERCENTAGE,
      value: 10,
      label: "Expired demonstration",
      minimumOrder: 0,
      expiresAt: new Date(now - 7 * day).toISOString(),
      usageLimit: 10,
      usageCount: 2,
      active: true,
      productIds: [],
      categories: [],
    },
    {
      id: "coupon-once",
      code: "ONCEONLY",
      type: COUPON_TYPE.FIXED,
      value: 15,
      label: "Single-use",
      minimumOrder: 40,
      expiresAt: new Date(now + 30 * day).toISOString(),
      usageLimit: 1,
      usageCount: 1,
      active: true,
      productIds: [],
      categories: [],
    },
    {
      id: "coupon-inactive",
      code: "PAUSED20",
      type: COUPON_TYPE.PERCENTAGE,
      value: 20,
      label: "Paused",
      minimumOrder: 0,
      expiresAt: new Date(now + 60 * day).toISOString(),
      usageLimit: null,
      usageCount: 0,
      active: false,
      productIds: [],
      categories: [],
    },
  ];
};

const REVIEW_SNIPPETS = [
  "Beautifully made and exactly as described.",
  "A considered everyday piece that has held up well.",
  "The materials feel honest and the fit is true.",
  "Arrived as expected. I would purchase again.",
  "Quiet luxury without the noise — a staple now.",
];

const buildReviews = (products) => {
  const editorial = products.filter((product) => product.id.startsWith("prod-") && product.id.length === 8);
  const reviews = [];
  editorial.slice(0, 18).forEach((product, productIndex) => {
    const count = 2 + (productIndex % 3);
    for (let index = 0; index < count; index += 1) {
      const rating = Math.min(5, Math.max(4, Math.round(product.rating) - (index % 2)));
      reviews.push({
        id: `rev-${product.id}-${index + 1}`,
        productId: product.id,
        userId: index % 2 === 0 ? "user-customer" : "user-guest",
        authorName: index % 2 === 0 ? "Avery Chen" : "Guest shopper",
        rating,
        text: REVIEW_SNIPPETS[(productIndex + index) % REVIEW_SNIPPETS.length],
        createdAt: new Date(Date.UTC(2026, productIndex % 8, 4 + index * 3)).toISOString(),
        helpfulVotes: (productIndex * 3 + index) % 14,
        verifiedPurchase: index === 0,
        status: REVIEW_STATUS.APPROVED,
      });
    }
  });
  return reviews;
};

const buildDemoOrder = (products) => {
  const tee = products.find((product) => product.id === "prod-001");
  const throwBlanket = products.find((product) => product.id === "prod-020");
  if (!tee || !throwBlanket) return [];
  const createdAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString();
  const items = [
    {
      id: "oi-demo-1",
      orderId: "order-demo-1001",
      productId: tee.id,
      variantId: tee.variants?.[0]?.id || null,
      productNameSnapshot: tee.name,
      skuSnapshot: tee.sku,
      imageSnapshot: tee.images?.[0],
      unitPriceSnapshot: tee.price,
      quantity: 1,
      subtotal: tee.price,
      options: { color: tee.colors?.[0], size: tee.sizes?.[2] || tee.sizes?.[0] },
    },
    {
      id: "oi-demo-2",
      orderId: "order-demo-1001",
      productId: throwBlanket.id,
      variantId: throwBlanket.variants?.[0]?.id || null,
      productNameSnapshot: throwBlanket.name,
      skuSnapshot: throwBlanket.sku,
      imageSnapshot: throwBlanket.images?.[0],
      unitPriceSnapshot: throwBlanket.price,
      quantity: 1,
      subtotal: throwBlanket.price,
    },
  ];
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  return [{
    id: "order-demo-1001",
    reference: "ORD-2026-DEMO01",
    userId: "user-customer",
    status: ORDER_STATUS.DELIVERED,
    contact: {
      name: "Avery Chen",
      email: "customer@morrow.demo",
      phone: "+1 415 555 0198",
    },
    shipping: {
      address: "18 Harbor Lane",
      city: "San Francisco",
      region: "CA",
      postalCode: "94107",
      country: "United States",
      countryCode: "US",
      method: "standard",
    },
    paymentMethod: "card",
    items,
    totals: {
      subtotal,
      discount: 0,
      shipping: 0,
      tax: Math.round(subtotal * 0.08 * 100) / 100,
      total: Math.round((subtotal + subtotal * 0.08) * 100) / 100,
    },
    timeline: [
      { status: ORDER_STATUS.PENDING, at: createdAt, note: "Demo order seeded" },
      { status: ORDER_STATUS.DELIVERED, at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(), note: "Marked delivered for demonstration" },
    ],
    createdAt,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
  }];
};

const buildAnalyticsEvents = (order) => {
  const events = [
    { type: ANALYTICS_EVENTS.PAGE_VIEW, entityId: "/", metadata: { path: "/" } },
    { type: ANALYTICS_EVENTS.PAGE_VIEW, entityId: "/shop.html", metadata: { path: "/shop.html" } },
    { type: ANALYTICS_EVENTS.SEARCH, entityId: "linen", metadata: { query: "linen", resultCount: 2 } },
    { type: ANALYTICS_EVENTS.PRODUCT_VIEW, entityId: "prod-001" },
    { type: ANALYTICS_EVENTS.PRODUCT_VIEW, entityId: "prod-003" },
    { type: ANALYTICS_EVENTS.PRODUCT_VIEW, entityId: "prod-020" },
    { type: ANALYTICS_EVENTS.ADD_TO_CART, entityId: "prod-001", metadata: { quantity: 1 } },
    { type: ANALYTICS_EVENTS.ADD_TO_CART, entityId: "prod-020", metadata: { quantity: 1 } },
    { type: ANALYTICS_EVENTS.WISHLIST_ADD, entityId: "prod-004" },
    { type: ANALYTICS_EVENTS.CHECKOUT_STARTED, entityId: order.id },
    {
      type: ANALYTICS_EVENTS.CHECKOUT_COMPLETED,
      entityId: order.id,
      metadata: { total: order.totals.total, itemCount: 2 },
    },
    {
      type: ANALYTICS_EVENTS.ORDER_CREATED,
      entityId: order.id,
      metadata: { total: order.totals.total },
    },
    {
      type: ANALYTICS_EVENTS.PURCHASE,
      entityId: order.id,
      metadata: { total: order.totals.total, itemCount: 2 },
    },
  ];
  const base = Date.now() - 1000 * 60 * 60 * 24 * 12;
  return events.map((event, index) => ({
    id: `evt-seed-${index + 1}`,
    type: event.type,
    userId: "user-customer",
    sessionId: "session-seed-demo",
    entityId: event.entityId,
    metadata: event.metadata || {},
    timestamp: new Date(base + index * 1000 * 60 * 12).toISOString(),
  }));
};

export const seedDatabase = async () => {
  const existing = await getMeta("seedVersion");
  if (existing) {
    if (existing.value < SEED_VERSION) {
      await atomic(["analyticsEvents", "orders", "reviews", "meta"], (tx) => {
        for (let index = 1; index <= 13; index += 1) {
          const event = tx.get("analyticsEvents", `evt-seed-${index}`);
          if (event) tx.put("analyticsEvents", { ...event, isFixture: true });
        }
        const order = tx.get("orders", "order-demo-1001");
        if (order) tx.put("orders", { ...order, isFixture: true, inventoryCommitted: false });
        tx.getAll("reviews").filter((row) => /^rev-prod-\d{3}-\d+$/.test(row.id)).forEach((row) => tx.put("reviews", { ...row, isFixture: true }));
        tx.put("meta", { key: "seedVersion", value: SEED_VERSION });
      });
    }
    return { seeded: false, productCount: await productRepository.count() };
  }

  const products = generateExtendedCatalog();
  const variants = products.flatMap((product) => product.variants || []);
  const persistableProducts = products.map(({ variants: _variants, ...product }) => ({ ...product, rating: 0, reviewCount: 0, popularity: 0 }));
  const { records, history } = buildInventory(products);
  const users = DEMO_USERS.map((user) => ({
    ...user,
    passwordSalt: DEMO_PASSWORD_SALT,
    passwordHash: DEMO_PASSWORD_SHA256,
    addresses: user.id === "user-customer"
      ? [{
        id: "addr-customer-home",
        label: "Home",
        name: "Avery Chen",
        address: "18 Harbor Lane",
        city: "San Francisco",
        region: "CA",
        postalCode: "94107",
        country: "United States",
        countryCode: "US",
        phone: "+1 415 555 0198",
        isDefault: true,
      }]
      : [],
    createdAt: "2026-01-12T10:00:00.000Z",
  }));
  const coupons = buildCoupons().map((coupon) => ({ ...coupon, usageCount: 0 }));
  const reviews = buildReviews(products).map((review) => ({ ...review, isFixture: true, helpfulVotes: 0, verifiedPurchase: false }));
  const orders = buildDemoOrder(products).map((order) => ({ ...order, isFixture: true, inventoryCommitted: false }));
  const categories = buildCategories(products);

  const batches = { products: persistableProducts, variants, inventory: records, inventoryHistory: history, users, coupons, reviews, categories, orders };
  await atomic([...Object.keys(batches), "meta"], (tx) => {
    if (tx.get("meta", "seedVersion")) return;
    Object.entries(batches).forEach(([store, rows]) => {
      rows.forEach((row) => {
        if (tx.get(store, row.id)) return;
        if (store === "users" && tx.getAll(store).some((user) => user.email === row.email)) return;
        if (store === "coupons" && tx.getAll(store).some((coupon) => coupon.code === row.code)) return;
        tx.put(store, { ...row, createdAt: row.createdAt || new Date().toISOString() });
      });
    });
    tx.put("meta", { key: "seedVersion", value: SEED_VERSION });
    tx.put("meta", { key: "seededAt", value: new Date().toISOString() });
  });

  return { seeded: true, productCount: persistableProducts.length };
};

export default seedDatabase;
