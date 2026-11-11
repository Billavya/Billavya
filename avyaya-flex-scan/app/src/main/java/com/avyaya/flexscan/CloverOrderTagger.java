package com.avyaya.flexscan;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import com.clover.sdk.util.CloverAccount;
import com.clover.sdk.v3.order.Discount;
import com.clover.sdk.v3.order.Order;
import com.clover.sdk.v3.order.OrderConnector;

/**
 * Writes the scanned customer's avyayaId (plus its rotating transaction token, when the QR carried
 * one — see MainActivity.TRANSACTION_TOKEN) into the Clover order's own `note` field, on-device, via
 * the local OrderConnector service (CloverAccount-bound — no REST/OAuth call, no new backend
 * endpoint). This is the actual point of the whole integration: functions/index.js's
 * cloverWebhook already scans a paid order's note for an AVY-XXXX-XXXX / SNB-XXXX-XXXX pattern
 * and forwards it to receiveInvoice — tagging the note here is what makes an invoice actually
 * land in the customer's Billavya app, not the offers/loyalty display (that's secondary).
 *
 * Pattern (OrderConnector usage, note field, finish-after-modify) confirmed against Clover's own
 * "modifyorderbutton" example (AddDiscountActivity.java) and com.clover.sdk.v3.order.Order's
 * real setNote/getNote methods — not guessed.
 */
final class CloverOrderTagger {

    interface Callback {
        void onSuccess();
        void onError(String message);
    }

    private CloverOrderTagger() {}

    static void tagOrderWithAvyayaId(Context context, String orderId, String noteValue, Callback callback) {
        Handler main = new Handler(Looper.getMainLooper());
        new Thread(() -> {
            OrderConnector orderConnector = null;
            try {
                orderConnector = new OrderConnector(context, CloverAccount.getAccount(context), null);
                orderConnector.connect();

                Order order = orderConnector.getOrder(orderId);
                String existingNote = order.isNotNullNote() ? order.getNote() : null;
                // Idempotent — a cashier re-scanning (or re-opening this screen) the same order
                // never duplicates the tag, and never wipes out anything the cashier already
                // typed into the note themselves.
                if (existingNote != null && existingNote.contains(noteValue)) {
                    orderConnector.disconnect();
                    main.post(callback::onSuccess);
                    return;
                }
                String newNote = (existingNote == null || existingNote.trim().isEmpty())
                        ? noteValue
                        : existingNote.trim() + " " + noteValue;
                order.setNote(newNote);
                orderConnector.updateOrder(order);
                orderConnector.disconnect();

                main.post(callback::onSuccess);
            } catch (Exception e) {
                if (orderConnector != null) {
                    try {
                        orderConnector.disconnect();
                    } catch (Exception ignored) {
                    }
                }
                main.post(() -> callback.onError(e.getMessage()));
            }
        }).start();
    }

    /**
     * Applies a real Clover order-level discount — not just a number shown on screen. Once this
     * lands, the paid order's own `discount` total reflects it, so when cloverWebhook forwards
     * that order to receiveInvoice, receiveInvoice's existing auto-detect-best-offer logic finds
     * a discount whose amount already matches one of this customer's offers and marks that exact
     * offer redeemed — no separate "which offer was this" step needed, and no double-discounting
     * (see the long comment on receiveInvoice in functions/index.js: "the actual discount is
     * still the POS's own number... auto-detecting here only prevents double-discounting by
     * leaving the money to whichever system the cashier actually used" — here, this app is that
     * system). Pattern confirmed against Clover's own AddDiscountActivity.java example.
     */
    static void applyDiscount(Context context, String orderId, long pct, String label, Callback callback) {
        Handler main = new Handler(Looper.getMainLooper());
        new Thread(() -> {
            OrderConnector orderConnector = null;
            try {
                orderConnector = new OrderConnector(context, CloverAccount.getAccount(context), null);
                orderConnector.connect();

                Discount discount = new Discount();
                discount.setPercentage(pct);
                discount.setName(label);
                orderConnector.addDiscount(orderId, discount);
                orderConnector.disconnect();

                main.post(callback::onSuccess);
            } catch (Exception e) {
                if (orderConnector != null) {
                    try {
                        orderConnector.disconnect();
                    } catch (Exception ignored) {
                    }
                }
                main.post(() -> callback.onError(e.getMessage()));
            }
        }).start();
    }
}
