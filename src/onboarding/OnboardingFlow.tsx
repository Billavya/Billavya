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
import { CITY_LIST } from "@/utils/location";

type Step = "name" | "email" | "birth" | "city" | "credentials" | "success" | "login";
const WIZARD_STEPS: Step[] = ["name", "email", "birth", "city", "credentials"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CURRENT_YEAR = new Date().getFullYear();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERID_RE = /^[A-Za-z0-9_]{3,20}$/;

interface Props {
  onComplete: (account: Account) => void;
}

export function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("name");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [birthMonth, setBirthMonth] = useState<string | null>(null);
  const [birthYear, setBirthYear] = useState("");
  const [city, setCity] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<Account | null>(null);

  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const nameValid = firstName.trim().length > 0 && lastName.trim().length > 0;
  const emailValid = EMAIL_RE.test(email.trim());
  const yearNum = parseInt(birthYear, 10);
  const birthValid = !!birthMonth && birthYear.length === 4 && yearNum >= 1900 && yearNum <= CURRENT_YEAR;
  const cityValid = city.trim().length > 0;
  const useridValid = USERID_RE.test(userId);
  const passwordValid = password.length >= 6;
  const passwordsMatch = password === confirmPassword;

  function stripToLetters(text: string): string {
    return text.replace(/[^A-Za-z]/g, "").slice(0, 40);
  }

  function goTo(next: Step) {
    setError("");
    setStep(next);
  }

  function next() {
    if (step === "name") {
      if (!nameValid) return setError("Enter your first and last name.");
      return goTo("email");
    }
    if (step === "email") {
      if (!emailValid) return setError("Enter a valid email address.");
      return goTo("birth");
    }
    if (step === "birth") {
      if (!birthValid) return setError("Pick a birth month and a valid 4-digit year.");
      return goTo("city");
    }
    if (step === "city") {
      if (!cityValid) return setError("Enter your city.");
      return goTo("credentials");
    }
  }

  function back() {
    setError("");
    const idx = WIZARD_STEPS.indexOf(step);
    if (idx > 0) setStep(WIZARD_STEPS[idx - 1]);
  }

  async function createAccount() {
    if (!useridValid) return setError("User ID must be 3–20 characters: letters, numbers, or underscore.");
    if (!passwordValid) return setError("Password must be at least 6 characters.");
    if (!passwordsMatch) return setError("Passwords don't match.");

    setBusy(true);
    setError("");
    try {
      const snapbillId = await getOrCreateProfileId();
      const record: ProfileRecord = {
        userId,
        password,
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthMonth: birthMonth!,
        birthYear,
        city: city.trim(),
        snapbillId,
        createdAtMs: Date.now(),
      };

      if (isFirebaseConfigured) {
        const available = await isUserIdAvailable(userId);
        if (!available) {
          setError("That User ID is taken — try another.");
          setBusy(false);
          return;
        }
        await createProfile(record);
      }

      setCreatedAccount(accountFromProfile(record));
      setStep("success");
    } catch {
      setError("Couldn't create your account — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    if (!loginId.trim() || !loginPassword) {
      setLoginError("Enter your User ID or email, and your password.");
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
        setLoginError("Incorrect User ID/email or password.");
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

  const stepIndex = WIZARD_STEPS.indexOf(step);

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

        {stepIndex >= 0 && (
          <>
            <View style={styles.progressRow}>
              {WIZARD_STEPS.map((s, i) => (
                <View key={s} style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]} />
              ))}
            </View>
            <Text style={styles.stepLabel}>
              Step {stepIndex + 1} of {WIZARD_STEPS.length}
            </Text>
          </>
        )}

        {step === "name" && (
          <View style={styles.card}>
            <Text style={styles.title}>What's your name?</Text>
            <Text style={styles.subtitle}>Letters only — no numbers or symbols, up to 40 characters each.</Text>
            <Text style={styles.fieldLabel}>First name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={(t) => setFirstName(stripToLetters(t))}
              placeholder="e.g. Ananya"
              placeholderTextColor={colors.muted2}
              maxLength={40}
              autoCapitalize="words"
            />
            <Text style={styles.fieldLabel}>Last name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={(t) => setLastName(stripToLetters(t))}
              placeholder="e.g. Iyer"
              placeholderTextColor={colors.muted2}
              maxLength={40}
              autoCapitalize="words"
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={styles.primaryBtn} onPress={next}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </Pressable>
            <Pressable style={styles.linkBtn} onPress={() => goTo("login")}>
              <Text style={styles.linkBtnText}>Already have an account? Log in</Text>
            </Pressable>
          </View>
        )}

        {step === "email" && (
          <View style={styles.card}>
            <Text style={styles.title}>What's your email?</Text>
            <Text style={styles.subtitle}>We'll check it's valid before moving on.</Text>
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
            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.navRow}>
              <Pressable style={styles.backBtn} onPress={back}>
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.flex1]} onPress={next}>
                <Text style={styles.primaryBtnText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === "birth" && (
          <View style={styles.card}>
            <Text style={styles.title}>When were you born?</Text>
            <Text style={styles.subtitle}>Month and year only.</Text>
            <View style={styles.chipWrap}>
              {MONTHS.map((m) => (
                <Pressable key={m} style={[styles.chip, birthMonth === m && styles.chipOn]} onPress={() => setBirthMonth(m)}>
                  <Text style={[styles.chipText, birthMonth === m && styles.chipTextOn]}>{m}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Birth year</Text>
            <TextInput
              style={styles.input}
              value={birthYear}
              onChangeText={(t) => setBirthYear(t.replace(/[^0-9]/g, "").slice(0, 4))}
              placeholder="e.g. 1998"
              placeholderTextColor={colors.muted2}
              keyboardType="number-pad"
              maxLength={4}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.navRow}>
              <Pressable style={styles.backBtn} onPress={back}>
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.flex1]} onPress={next}>
                <Text style={styles.primaryBtnText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === "city" && (
          <View style={styles.card}>
            <Text style={styles.title}>Where are you based?</Text>
            <Text style={styles.subtitle}>Just your city — this powers the Location filter in Search.</Text>
            <View style={styles.chipWrap}>
              {CITY_LIST.map((c) => (
                <Pressable key={c} style={[styles.chip, city === c && styles.chipOn]} onPress={() => setCity(c)}>
                  <Text style={[styles.chipText, city === c && styles.chipTextOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Type your city"
              placeholderTextColor={colors.muted2}
              autoCapitalize="words"
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.navRow}>
              <Pressable style={styles.backBtn} onPress={back}>
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.flex1]} onPress={next}>
                <Text style={styles.primaryBtnText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === "credentials" && (
          <View style={styles.card}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>You'll use this User ID or your email to log in later.</Text>
            <Text style={styles.fieldLabel}>User ID</Text>
            <TextInput
              style={styles.input}
              value={userId}
              onChangeText={(t) => setUserId(t.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20))}
              placeholder="3-20 characters: letters, numbers, _"
              placeholderTextColor={colors.muted2}
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
                Firebase isn't configured on this build — your account will work on this device, but User ID/email login
                from another device needs the setup in SETUP.txt.
              </Text>
            )}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.navRow}>
              <Pressable style={styles.backBtn} onPress={back} disabled={busy}>
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.flex1, busy && styles.primaryBtnDisabled]} onPress={createAccount} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create account</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {step === "success" && createdAccount && (
          <View style={styles.card}>
            <View style={styles.successIcon}>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                <Path d="M5 13l4 4L19 7" stroke={colors.teal} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.title}>You're all set, {createdAccount.firstName}!</Text>
            <Text style={styles.subtitle}>
              Your account (<Text style={styles.bold}>{createdAccount.userId}</Text>) is ready. From now on you can log in
              with either your <Text style={styles.bold}>User ID</Text> or your <Text style={styles.bold}>email</Text>.
            </Text>
            <Pressable style={styles.primaryBtn} onPress={() => onComplete(createdAccount)}>
              <Text style={styles.primaryBtnText}>Continue to SnapBill</Text>
            </Pressable>
          </View>
        )}

        {step === "login" && (
          <View style={styles.card}>
            <Text style={styles.title}>Log in</Text>
            <Text style={styles.subtitle}>Use the User ID or email from a SnapBill account you've already created.</Text>
            <Text style={styles.fieldLabel}>User ID or email</Text>
            <TextInput
              style={styles.input}
              value={loginId}
              onChangeText={setLoginId}
              placeholder="User ID or email"
              placeholderTextColor={colors.muted2}
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
            <Pressable style={styles.linkBtn} onPress={() => goTo("name")}>
              <Text style={styles.linkBtnText}>New here? Create an account</Text>
            </Pressable>
          </View>
        )}
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
  progressRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 6 },
  progressDot: { width: 22, height: 4, borderRadius: 2, backgroundColor: colors.line },
  progressDotActive: { backgroundColor: colors.teal },
  stepLabel: { textAlign: "center", fontFamily: fonts.bodySemibold, fontSize: 10.5, color: colors.muted2, marginBottom: 18 },

  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 22 },
  title: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.navy, textAlign: "center" },
  subtitle: { marginTop: 6, fontFamily: fonts.bodyRegular, fontSize: 12.5, lineHeight: 18, color: colors.navy2, textAlign: "center" },
  bold: { fontFamily: fonts.bodyBold },

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

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 6 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.appBg },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.navy2 },
  chipTextOn: { color: "#fff" },

  navRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  flex1: { flex: 1, marginTop: 0 },
  primaryBtn: { marginTop: 20, height: 50, borderRadius: 14, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#fff" },
  backBtn: { height: 50, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  backBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.navy2 },
  linkBtn: { marginTop: 14, alignItems: "center" },
  linkBtnText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.tealDark },

  successIcon: { alignSelf: "center", width: 56, height: 56, borderRadius: 28, backgroundColor: colors.tealTint, alignItems: "center", justifyContent: "center", marginBottom: 6 },
});
