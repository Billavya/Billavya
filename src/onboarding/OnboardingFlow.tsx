import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { getOrCreateProfileId, setProfileId } from "@/utils/profileId";
import { Account, accountFromProfile } from "@/utils/account";
import { createProfile, findProfile, isUserIdAvailable, ProfileRecord } from "@/services/profiles";
import { isFirebaseConfigured } from "@/config/firebase";
import { getDeviceInfo } from "@/utils/device";

type Mode = "signup" | "login";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  onComplete: (account: Account) => void;
}

function stripToLetters(text: string): string {
  return text.replace(/[^A-Za-z]/g, "").slice(0, 40);
}

/** Turns an email's local part into a valid, available User ID — nobody has
 *  to invent one. "phani.k99@gmail.com" -> "phanik99" (then "phanik991",
 *  "phanik992"... only if that's somehow already taken). */
async function generateUserId(email: string): Promise<string> {
  const local = email.split("@")[0] || "user";
  const base = (local.replace(/[^A-Za-z0-9_]/g, "").slice(0, 16) || "user").padEnd(3, "0");
  let candidate = base;
  let suffix = 1;
  while (!(await isUserIdAvailable(candidate))) {
    candidate = `${base}${suffix}`.slice(0, 20);
    suffix += 1;
  }
  return candidate;
}

export function OnboardingFlow({ onComplete }: Props) {
  const [mode, setMode] = useState<Mode>("signup");

  // Sign up
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupBusy, setSignupBusy] = useState(false);

  // Log in
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  function switchMode(next: Mode) {
    setSignupError("");
    setLoginError("");
    setMode(next);
  }

  async function handleSignUp() {
    const nameValid = firstName.trim().length > 0 && lastName.trim().length > 0;
    const emailValid = EMAIL_RE.test(email.trim());
    const passwordValid = password.length >= 6;

    if (!nameValid) return setSignupError("Enter your first and last name.");
    if (!emailValid) return setSignupError("Enter a valid email address.");
    if (!passwordValid) return setSignupError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setSignupError("Passwords don't match.");

    setSignupBusy(true);
    setSignupError("");
    try {
      const cleanEmail = email.trim().toLowerCase();

      if (isFirebaseConfigured) {
        const existing = await findProfile(cleanEmail);
        if (existing) {
          setSignupError("An account with this email already exists — log in instead.");
          setSignupBusy(false);
          return;
        }
      }

      const snapbillId = await getOrCreateProfileId();
      const userId = isFirebaseConfigured ? await generateUserId(cleanEmail) : cleanEmail.split("@")[0] || "user";
      const record: ProfileRecord = {
        userId,
        password,
        email: cleanEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        snapbillId,
        createdAtMs: Date.now(),
        device: getDeviceInfo(),
      };

      if (isFirebaseConfigured) {
        await createProfile(record);
      }

      onComplete(accountFromProfile(record));
    } catch {
      setSignupError("Couldn't create your account — check your connection and try again.");
    } finally {
      setSignupBusy(false);
    }
  }

  async function handleLogin() {
    if (!loginId.trim() || !loginPassword) {
      setLoginError("Enter your email and password.");
      return;
    }
    if (!isFirebaseConfigured) {
      setLoginError("Logging in to an existing account needs the Firebase setup in SETUP.txt.");
      return;
    }
    setLoginBusy(true);
    setLoginError("");
    try {
      const profile = await findProfile(loginId.trim());
      if (!profile || profile.password !== loginPassword) {
        setLoginError("Incorrect email or password.");
        return;
      }
      await setProfileId(profile.snapbillId);
      onComplete(accountFromProfile(profile));
    } catch {
      setLoginError("Couldn't log in — check your connection and try again.");
    } finally {
      setLoginBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Rect x="3" y="3" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
              <Rect x="13" y="3" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
              <Rect x="3" y="13" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
              <Path d="M15 17h6M18 14v6" stroke={colors.teal} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.brandName}>SnapBill</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabs}>
            <Pressable style={[styles.tab, mode === "signup" && styles.tabOn]} onPress={() => switchMode("signup")}>
              <Text style={[styles.tabText, mode === "signup" && styles.tabTextOn]}>Sign Up</Text>
            </Pressable>
            <Pressable style={[styles.tab, mode === "login" && styles.tabOn]} onPress={() => switchMode("login")}>
              <Text style={[styles.tabText, mode === "login" && styles.tabTextOn]}>Log In</Text>
            </Pressable>
          </View>

          {mode === "signup" ? (
            <>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>Just your name, email, and a password — you're in.</Text>

              <View style={styles.row}>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>First name</Text>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={(t) => setFirstName(stripToLetters(t))}
                    placeholder="Ananya"
                    placeholderTextColor={colors.muted2}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>Last name</Text>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={(t) => setLastName(stripToLetters(t))}
                    placeholder="Iyer"
                    placeholderTextColor={colors.muted2}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted2}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.muted2}
                secureTextEntry
              />

              <Text style={styles.fieldLabel}>Confirm password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Type it again"
                placeholderTextColor={colors.muted2}
                secureTextEntry
              />

              {!isFirebaseConfigured && (
                <Text style={styles.notice}>
                  Firebase isn't configured on this build — your account will work on this device, but logging in from
                  another device needs the setup in SETUP.txt.
                </Text>
              )}
              {!!signupError && <Text style={styles.error}>{signupError}</Text>}

              <Pressable style={[styles.primaryBtn, signupBusy && styles.primaryBtnDisabled]} onPress={handleSignUp} disabled={signupBusy}>
                {signupBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create account</Text>}
              </Pressable>
              <Text style={styles.hint}>Your SnapBill ID (used to link invoices at checkout) is generated automatically.</Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Log in with the email from your SnapBill account.</Text>

              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={loginId}
                onChangeText={setLoginId}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted2}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={loginPassword}
                onChangeText={setLoginPassword}
                placeholder="Password"
                placeholderTextColor={colors.muted2}
                secureTextEntry
              />
              {!!loginError && <Text style={styles.error}>{loginError}</Text>}
              <Pressable style={[styles.primaryBtn, loginBusy && styles.primaryBtnDisabled]} onPress={handleLogin} disabled={loginBusy}>
                {loginBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Log in</Text>}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  scroll: { flexGrow: 1, padding: 24, justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", marginBottom: 22 },
  brandMark: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  brandName: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.navy },

  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 22 },

  tabs: { flexDirection: "row", gap: 6, backgroundColor: colors.appBg, borderRadius: 12, padding: 4, marginBottom: 18 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  tabOn: { backgroundColor: colors.card, shadowColor: colors.navy, shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.muted2 },
  tabTextOn: { color: colors.navy },

  title: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.navy, textAlign: "center" },
  subtitle: { marginTop: 6, fontFamily: fonts.bodyRegular, fontSize: 12.5, lineHeight: 18, color: colors.navy2, textAlign: "center" },

  row: { flexDirection: "row", gap: 12 },
  flex1: { flex: 1 },

  fieldLabel: { marginTop: 16, marginBottom: 6, fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.4, textTransform: "uppercase", color: colors.muted2 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.navy2,
    backgroundColor: colors.appBg,
  },
  notice: { marginTop: 12, fontFamily: fonts.bodyRegular, fontSize: 10.5, lineHeight: 15, color: colors.muted, backgroundColor: colors.appBg, borderRadius: 10, padding: 10 },
  error: { marginTop: 12, fontFamily: fonts.bodySemibold, fontSize: 11.5, color: "#B91C1C", textAlign: "center" },

  primaryBtn: { marginTop: 20, height: 50, borderRadius: 14, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#fff" },
  hint: { marginTop: 10, fontFamily: fonts.bodyRegular, fontSize: 10.5, lineHeight: 15, color: colors.muted2, textAlign: "center" },
});
