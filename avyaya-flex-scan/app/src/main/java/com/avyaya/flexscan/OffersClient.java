package com.avyaya.flexscan;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Calls the existing exports.lookupOffers and exports.lookupLoyalty Cloud Functions
 * (functions/index.js). Both were already deployed (lookupOffers) or added alongside this app
 * (lookupLoyalty, a real accrual ledger — see the long comment on receiveInvoice) — this class
 * just gives the Flex a caller for them, no other backend work implied here.
 */
final class OffersClient {
    private static final String OFFERS_URL = "https://us-central1-letsgetdirty.cloudfunctions.net/lookupOffers";
    private static final String LOYALTY_URL = "https://us-central1-letsgetdirty.cloudfunctions.net/lookupLoyalty";

    static final class Offer {
        final String code;
        final double pct;
        final String desc;

        Offer(String code, double pct, String desc) {
            this.code = code;
            this.pct = pct;
            this.desc = desc;
        }
    }

    interface OffersCallback {
        void onSuccess(List<Offer> offers);
        void onError(String message);
    }

    interface LoyaltyCallback {
        void onSuccess(int points);
        void onError(String message);
    }

    private OffersClient() {}

    static void lookupOffers(String apiKey, String avyayaId, OffersCallback callback) {
        Handler main = new Handler(Looper.getMainLooper());
        new Thread(() -> {
            try {
                JSONObject json = getJson(OFFERS_URL, apiKey, avyayaId);
                JSONArray arr = json.optJSONArray("offers");
                List<Offer> offers = new ArrayList<>();
                if (arr != null) {
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject o = arr.getJSONObject(i);
                        offers.add(new Offer(
                                o.isNull("code") ? null : o.optString("code"),
                                o.optDouble("pct", 0),
                                o.optString("desc", "")
                        ));
                    }
                }
                main.post(() -> callback.onSuccess(offers));
            } catch (Exception e) {
                main.post(() -> callback.onError(e.getMessage()));
            }
        }).start();
    }

    static void lookupLoyalty(String apiKey, String avyayaId, LoyaltyCallback callback) {
        Handler main = new Handler(Looper.getMainLooper());
        new Thread(() -> {
            try {
                JSONObject json = getJson(LOYALTY_URL, apiKey, avyayaId);
                int points = json.optInt("points", 0);
                main.post(() -> callback.onSuccess(points));
            } catch (Exception e) {
                main.post(() -> callback.onError(e.getMessage()));
            }
        }).start();
    }

    /** Shared GET + Bearer-auth + success-envelope handling for both endpoints above. Runs on the caller's (background) thread — never call from the main thread. */
    private static JSONObject getJson(String baseUrl, String apiKey, String avyayaId) throws Exception {
        HttpURLConnection conn = null;
        try {
            String url = baseUrl + "?avyayaId=" + URLEncoder.encode(avyayaId, "UTF-8");
            conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + apiKey);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            int status = conn.getResponseCode();
            InputStream stream = status >= 200 && status < 300 ? conn.getInputStream() : conn.getErrorStream();
            String body = readAll(stream);
            JSONObject json = new JSONObject(body);

            if (status < 200 || status >= 300 || !json.optBoolean("success", false)) {
                throw new Exception(json.optString("error", "Request failed (HTTP " + status + ")"));
            }
            return json;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "{}";
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
        }
        return sb.toString();
    }
}
