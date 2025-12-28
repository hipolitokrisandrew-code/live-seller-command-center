const BASE_API_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function invoiceEndpoint(orderId: string) {
  const relativePath = `/orders/${orderId}/invoice`;
  if (BASE_API_URL) {
    return `${BASE_API_URL}${relativePath}`;
  }
  return relativePath;
}

export async function openInvoiceSameTab(orderId: string): Promise<void> {
  const url = invoiceEndpoint(orderId);
  const response = await fetch(url, {
    headers: {
      Accept: "application/pdf",
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch invoice PDF");
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.location.assign(blobUrl);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}
