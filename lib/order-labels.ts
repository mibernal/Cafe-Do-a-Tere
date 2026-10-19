export const orderStatusLabels: Record<string, string> = {
  AWAITING_PAYMENT: "Esperando pago",
  COD_PENDING: "Contra entrega por confirmar",
  PAID: "Pagado",
  PAYMENT_REVIEW: "Pago por revisar",
  PREPARING: "En preparación",
  SHIPPED: "Despachado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

export const paymentMethodLabels: Record<string, string> = {
  WOMPI: "Pago en línea (Wompi)",
  CASH_ON_DELIVERY: "Contra entrega",
};
