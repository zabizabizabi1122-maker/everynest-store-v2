import { secondaryButtonClass } from "@/components/ui/form";

interface OrderContactLinksProps {
  phone: string;
  email: string | null;
  orderNumber: string;
  customerName: string;
  firstItemName: string;
  quantity: number;
}

/**
 * Staff-only contact shortcuts for a single order. Presentational and
 * server-compatible: every link is built from the immutable order snapshot.
 */
export function OrderContactLinks({
  phone,
  email,
  orderNumber,
  customerName,
  firstItemName,
  quantity,
}: OrderContactLinksProps) {
  const phoneDigits = phone.replace(/\D/g, "");
  const whatsappMessage =
    `Hello ${customerName}, this is EveryNest support contacting you to verify order ${orderNumber}. ` +
    `Product: ${firstItemName}. Quantity: ${quantity}. Please confirm your details so we can proceed.`;
  const whatsappHref = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(whatsappMessage)}`;

  const emailAddress = email?.trim() || null;
  const emailSubject = `Regarding order ${orderNumber} · EveryNest`;
  const emailBody =
    `Hello ${customerName},\n\n` +
    `I'm contacting you to verify your order ${orderNumber}.\n` +
    `Product: ${firstItemName}\n` +
    `Quantity: ${quantity}\n` +
    `Mobile on order: ${phone}\n\n` +
    "Please confirm your details so we can proceed.";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className={secondaryButtonClass}
      >
        WhatsApp
      </a>
      <a href={`tel:${phone}`} className={secondaryButtonClass}>
        Call
      </a>
      {emailAddress ? (
        <a
          href={`mailto:${emailAddress}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
          className={secondaryButtonClass}
        >
          Email
        </a>
      ) : (
        <span aria-disabled="true" className={`${secondaryButtonClass} pointer-events-none opacity-60`}>
          Email not provided
        </span>
      )}
    </div>
  );
}
