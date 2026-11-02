package com.avyaya.flexscan;

import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.clover.sdk.v1.Intents;
import com.clover.sdk.v3.scanner.BarcodeResult;
import com.clover.sdk.v3.scanner.BarcodeScanner;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Two entry points into the same screen:
 *
 * 1. Home screen icon (MAIN/LAUNCHER) — standalone: cashier taps "Scan Customer QR" any time,
 *    sees the customer's offers/discount %/loyalty points. Nothing is written back to Clover.
 *
 * 2. A button Clover itself adds to the Payments screen (clover.intent.action.MODIFY_ORDER —
 *    see AndroidManifest.xml) — launched with the order about to be paid. This is the real point
 *    of the app: scanning here also tags that order's `note` field with the customer's avyayaId
 *    (via CloverOrderTagger/OrderConnector, on-device, no new backend call), which is what the
 *    already-deployed cloverWebhook -> receiveInvoice chain needs to find in order to push a
 *    digital invoice into the customer's Billavya app once the sale completes. The offers/
 *    loyalty display is secondary to that — useful for the cashier, not the actual goal.
 */
public class MainActivity extends AppCompatActivity {

    // Matches src/utils/profileId.ts AVYAYA ID shape (AVY- or legacy SNB-, 4+4 chars).
    private static final Pattern AVYAYA_ID_IN_URI =
            Pattern.compile("(?:AVY|SNB)-[A-Z0-9]{4}-[A-Z0-9]{4}", Pattern.CASE_INSENSITIVE);

    private BarcodeScanner barcodeScanner;
    private TextView statusText;
    private TextView customerIdText;
    private LinearLayout customerCard;
    private LinearLayout offersContainer;
    private TextView loyaltyText;
    private Button continueButton;

    /** Non-null only when launched via ACTION_MODIFY_ORDER — the order about to be paid. */
    @Nullable
    private String pendingOrderId;

    // Gate auto-return on both finishing, so a slow discount-apply call can't lose a race with
    // the "glimpse the screen, then return" timer below.
    private boolean tagStepDone;
    private boolean offersStepDone;

    private final BroadcastReceiver barcodeReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            BarcodeResult result = new BarcodeResult(intent);
            if (!result.isBarcodeAction()) return;
            handleScannedValue(result.getBarcode());
        }
    };

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        statusText = findViewById(R.id.statusText);
        customerCard = findViewById(R.id.customerCard);
        customerIdText = findViewById(R.id.customerIdText);
        offersContainer = findViewById(R.id.offersContainer);
        loyaltyText = findViewById(R.id.loyaltyText);
        continueButton = findViewById(R.id.continueButton);

        Button scanButton = findViewById(R.id.scanButton);
        TextView merchantKeyLink = findViewById(R.id.merchantKeyLink);

        barcodeScanner = new BarcodeScanner(this);
        pendingOrderId = getIntent().getStringExtra(Intents.EXTRA_ORDER_ID);

        scanButton.setOnClickListener(v -> startScan());
        merchantKeyLink.setOnClickListener(v -> promptForApiKey());
        continueButton.setOnClickListener(v -> returnToOrderScreen());

        if (ApiKeyStore.get(this) == null) {
            promptForApiKey();
        } else if (pendingOrderId != null) {
            // Launched from the Payments screen's own button — the cashier already chose
            // "Avyaya" as the action; skip straight to scanning instead of making them tap twice.
            startScan();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        ContextCompat.registerReceiver(
                this,
                barcodeReceiver,
                new IntentFilter(BarcodeResult.INTENT_ACTION),
                ContextCompat.RECEIVER_EXPORTED
        );
    }

    @Override
    protected void onPause() {
        super.onPause();
        unregisterReceiver(barcodeReceiver);
    }

    private void startScan() {
        if (ApiKeyStore.get(this) == null) {
            promptForApiKey();
            return;
        }
        customerCard.setVisibility(View.GONE);
        continueButton.setVisibility(View.GONE);
        tagStepDone = false;
        offersStepDone = false;
        statusText.setText("Scanning… hold the QR up to the camera");

        Bundle extras = new Bundle();
        extras.putBoolean(Intents.EXTRA_LED_ON, false);
        extras.putBoolean(Intents.EXTRA_SCAN_QR_CODE, true);
        extras.putBoolean(Intents.EXTRA_SCAN_1D_CODE, false);
        barcodeScanner.executeStartScan(extras);
    }

    private void handleScannedValue(String rawValue) {
        if (rawValue == null) {
            statusText.setText("Scan didn't return anything — try again");
            return;
        }

        String avyayaId = extractAvyayaId(rawValue);
        if (avyayaId == null) {
            statusText.setText("Not an Avyaya QR code");
            Toast.makeText(this, "Scanned value wasn't an Avyaya customer code", Toast.LENGTH_SHORT).show();
            return;
        }

        statusText.setText("Looking up " + avyayaId + "…");
        tagOrderIfNeeded(avyayaId);

        String apiKey = ApiKeyStore.get(this);
        OffersClient.lookupOffers(apiKey, avyayaId, new OffersClient.OffersCallback() {
            @Override
            public void onSuccess(List<OffersClient.Offer> offers) {
                showCustomer(avyayaId, offers);
                applyBestDiscountIfAny(offers);
            }

            @Override
            public void onError(String message) {
                statusText.setText("Couldn't look up customer: " + message);
                offersStepDone = true;
                maybeAutoReturn();
            }
        });

        loyaltyText.setText("Loyalty points: …");
        OffersClient.lookupLoyalty(apiKey, avyayaId, new OffersClient.LoyaltyCallback() {
            @Override
            public void onSuccess(int points) {
                loyaltyText.setText("Loyalty points: " + points);
            }

            @Override
            public void onError(String message) {
                loyaltyText.setText("Loyalty points: unavailable");
            }
        });
    }

    // Long enough to glimpse the offers/loyalty on screen, short enough that the cashier isn't
    // stuck waiting — the cashier can still tap Continue to skip the wait entirely.
    private static final long AUTO_RETURN_DELAY_MS = 3000;

    /**
     * The actual point of this whole app (see class doc) — only runs when launched from the
     * Payments screen. Independent of the offers lookup: tagging the order (so the invoice later
     * reaches Billavya) must not be held up by, or fail because of, the separate discount step.
     */
    private void tagOrderIfNeeded(String avyayaId) {
        if (pendingOrderId == null) return;
        CloverOrderTagger.tagOrderWithAvyayaId(this, pendingOrderId, avyayaId, new CloverOrderTagger.Callback() {
            @Override
            public void onSuccess() {
                tagStepDone = true;
                maybeAutoReturn();
            }

            @Override
            public void onError(String message) {
                Toast.makeText(MainActivity.this, "Couldn't tag the order: " + message, Toast.LENGTH_LONG).show();
                tagStepDone = true;
                maybeAutoReturn();
            }
        });
    }

    /** Applies the single highest-% offer found, as a real Clover order discount (see CloverOrderTagger.applyDiscount). */
    private void applyBestDiscountIfAny(List<OffersClient.Offer> offers) {
        if (pendingOrderId == null || offers.isEmpty()) {
            offersStepDone = true;
            maybeAutoReturn();
            return;
        }

        OffersClient.Offer best = offers.get(0);
        for (OffersClient.Offer o : offers) {
            if (o.pct > best.pct) best = o;
        }
        if (best.pct <= 0) {
            offersStepDone = true;
            maybeAutoReturn();
            return;
        }

        // The code goes into the Clover discount's own name, bracketed exactly the way the
        // on-screen offer list already renders it (see showCustomer() below) — cloverWebhook
        // reads this same bracketed code back off the paid order to tell receiveInvoice exactly
        // which offer was redeemed, instead of leaving it to auto-detect the best active offer
        // (which can pick the wrong one when a customer has more than one active offer here).
        String desc = (best.desc != null && !best.desc.isEmpty()) ? best.desc : "Avyaya Offer";
        String label = (best.code != null && !best.code.isEmpty()) ? desc + " [" + best.code + "]" : desc;
        long pctToApply = (long) best.pct;
        CloverOrderTagger.applyDiscount(this, pendingOrderId, pctToApply, label, new CloverOrderTagger.Callback() {
            @Override
            public void onSuccess() {
                // Unambiguous on-screen confirmation that the SDK call itself reported success —
                // the Clover order's own data is the only way to confirm the discount actually
                // landed, this just confirms our call didn't throw.
                Toast.makeText(MainActivity.this, "Discount applied: " + pctToApply + "%", Toast.LENGTH_LONG).show();
                offersStepDone = true;
                maybeAutoReturn();
            }

            @Override
            public void onError(String message) {
                Toast.makeText(MainActivity.this, "Couldn't apply discount: " + message, Toast.LENGTH_LONG).show();
                offersStepDone = true;
                maybeAutoReturn();
            }
        });
    }

    /** Returns to the order screen on its own once both steps settle — the cashier is never required to tap Continue, only given the option to skip the short wait. */
    private void maybeAutoReturn() {
        if (pendingOrderId == null || !tagStepDone || !offersStepDone) return;
        continueButton.setVisibility(View.VISIBLE);
        new Handler(Looper.getMainLooper()).postDelayed(this::returnToOrderScreen, AUTO_RETURN_DELAY_MS);
    }

    /**
     * Deliberately does NOT just finish() back to whatever Payments-screen instance launched us.
     * In practice that screen doesn't re-read the order after we return to it — its cash/amount
     * buttons were rendered from the order's PRE-discount total and stay stale even though
     * addDiscount already succeeded, so the cashier sees the wrong amount every time. Explicitly
     * relaunching Register on this order forces a fresh read of current order state (now
     * including the discount), landing the cashier on the order screen rather than Payments —
     * they tap Pay again from there, and that fresh Payments screen renders the correct,
     * already-discounted total. Confirmed pattern: com.clover.sdk.v1.Intents.ACTION_START_REGISTER
     * javadoc — "Launch Register Point of Sale activity... EXTRA_ORDER_ID - The UUID of the order
     * opened in Register" — not guessed.
     */
    private void returnToOrderScreen() {
        if (pendingOrderId != null) {
            Intent register = new Intent(Intents.ACTION_START_REGISTER);
            register.putExtra(Intents.EXTRA_ORDER_ID, pendingOrderId);
            startActivity(register);
        }
        finish();
    }

    private void showCustomer(String avyayaId, List<OffersClient.Offer> offers) {
        statusText.setText("Ready to scan a customer's Avyaya QR");
        customerIdText.setText(avyayaId);
        customerCard.setVisibility(View.VISIBLE);
        offersContainer.removeAllViews();

        if (offers.isEmpty()) {
            TextView none = new TextView(this);
            none.setText("No active offers right now");
            none.setTextColor(getColor(R.color.avyaya_muted));
            offersContainer.addView(none);
            return;
        }

        for (OffersClient.Offer offer : offers) {
            TextView row = new TextView(this);
            StringBuilder label = new StringBuilder();
            if (offer.pct > 0) label.append((int) offer.pct).append("% off");
            if (offer.desc != null && !offer.desc.isEmpty()) {
                if (label.length() > 0) label.append(" — ");
                label.append(offer.desc);
            }
            if (offer.code != null && !offer.code.isEmpty()) {
                label.append("  [").append(offer.code).append("]");
            }
            row.setText(label.toString());
            row.setTextColor(getColor(R.color.avyaya_ink));
            row.setTextSize(15f);
            row.setPadding(0, 10, 0, 10);
            offersContainer.addView(row);
        }
    }

    private void promptForApiKey() {
        EditText input = new EditText(this);
        input.setHint("Merchant API key");
        String existing = ApiKeyStore.get(this);
        if (existing != null) input.setText(existing);

        LinearLayout wrap = new LinearLayout(this);
        wrap.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        wrap.setPadding(pad, pad, pad, pad);
        wrap.addView(input);

        new AlertDialog.Builder(this)
                .setTitle("Set merchant API key")
                .setMessage("The same key pos-web/merchant-portal use to call Avyaya's backend.")
                .setView(wrap)
                .setPositiveButton("Save", (dialog, which) -> {
                    String key = input.getText().toString().trim();
                    if (!key.isEmpty()) ApiKeyStore.set(this, key);
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    @Nullable
    private String extractAvyayaId(String rawValue) {
        Matcher m = AVYAYA_ID_IN_URI.matcher(rawValue);
        if (m.find()) {
            return m.group().toUpperCase();
        }
        return null;
    }
}
