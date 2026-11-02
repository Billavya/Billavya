package com.avyaya.flexscan;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Stores this Flex's merchant apiKey (the same Bearer credential pos-web/merchant-portal use
 * against lookupOffers/receiveInvoice — see functions/index.js authenticateMerchant). Entered
 * once on-device via the "Set merchant API key" link rather than hardcoded, since a different
 * physical Flex could be associated with a different Avyaya merchant.
 */
final class ApiKeyStore {
    private static final String PREFS = "avyaya_flexscan_prefs";
    private static final String KEY_API_KEY = "merchant_api_key";

    private ApiKeyStore() {}

    static String get(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return prefs.getString(KEY_API_KEY, null);
    }

    static void set(Context context, String apiKey) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_API_KEY, apiKey).apply();
    }
}
