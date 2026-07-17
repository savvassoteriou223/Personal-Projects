import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isHealthAvailable } from '../lib/healthService';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';

export default function HealthPanel({ healthAuthorized, healthLoading, recoveryData, onConnect, onDisconnect }) {
  const { t } = useTranslation();
  return (
    <View style={{ paddingTop: 4 }}>

      {/* The "unavailable" / "install Health Connect" placeholders that used to
          live here are gone: TABS only offers this tab when isHealthAvailable()
          is true, so they were unreachable. A tab whose only content is "this
          tab does nothing" should not exist. */}
      {isHealthAvailable() && !healthAuthorized && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.connect', { provider: Platform.OS === 'ios' ? t('profile.providerApple') : t('profile.providerHC') })}</Text>
          <Text style={styles.healthDesc}>
            {t('profile.healthDesc', { provider: Platform.OS === 'ios' ? t('profile.providerApple') : t('profile.providerHC'), companion: Platform.OS === 'ios' ? '' : t('profile.companionAndroid') })}
          </Text>
          <Tappable style={styles.healthConnectBtn} onPress={onConnect} disabled={healthLoading}>
            <Text style={styles.healthConnectBtnText}>
              {healthLoading ? t('profile.connecting') : t('profile.connectBtn')}
            </Text>
          </Tappable>
        </View>
      )}

      {isHealthAvailable() && healthAuthorized && (
        <>
          {/* Recovery status */}
          <View style={[styles.card, recoveryData?.status && { borderColor: recoveryData.status.color + '44', borderWidth: 1 }]}>
            <Text style={styles.cardTitle}>{t('profile.todayRecovery')}</Text>
            {!recoveryData?.status && (
              <Text style={styles.empty}>{t('profile.noHealthToday')}</Text>
            )}
            {recoveryData?.status && (
              <>
                <Text style={[styles.healthStatusLabel, { color: recoveryData.status.color }]}>
                  {recoveryData.status.label}
                </Text>
                <View style={styles.healthMetricsRow}>
                  {recoveryData.sleep !== null && (
                    <View style={styles.healthMetric}>
                      <Text style={styles.healthMetricVal}>{recoveryData.sleep}h</Text>
                      <Text style={styles.healthMetricLabel}>{t('profile.sleep')}</Text>
                    </View>
                  )}
                  {recoveryData.hrv !== null && (
                    <View style={styles.healthMetric}>
                      <Text style={styles.healthMetricVal}>{recoveryData.hrv} ms</Text>
                      <Text style={styles.healthMetricLabel}>{t('profile.hrv')}</Text>
                    </View>
                  )}
                  {recoveryData.rhr !== null && (
                    <View style={styles.healthMetric}>
                      <Text style={styles.healthMetricVal}>{recoveryData.rhr} bpm</Text>
                      <Text style={styles.healthMetricLabel}>{t('profile.restingHr')}</Text>
                    </View>
                  )}
                </View>
                {recoveryData.status.advice && (
                  <Text style={styles.healthAdvice}>{recoveryData.status.advice}</Text>
                )}
              </>
            )}
          </View>

          {/* What we read */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('profile.dataSources')}</Text>
            {[
              [t('profile.sourceSleep'), t('profile.sourceSleepDesc')],
              [t('profile.hrv'), Platform.OS === 'ios' ? t('profile.sourceHrvDescIos') : t('profile.sourceHrvDescAndroid')],
              [t('profile.sourceRhr'), t('profile.sourceRhrDesc')],
            ].map(([name, desc]) => (
              <View key={name} style={styles.healthSourceRow}>
                <Text style={styles.healthSourceName}>{name}</Text>
                <Text style={styles.healthSourceDesc}>{desc}</Text>
              </View>
            ))}
          </View>

          {/* Disconnect */}
          <Tappable style={styles.healthDisconnectBtn} onPress={onDisconnect}>
            <Text style={styles.healthDisconnectText}>{t('profile.disconnect')}</Text>
          </Tappable>
        </>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border, marginTop: 14, overflow: 'hidden' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  empty: { fontSize: 13, color: colors.textSubtle },
  healthDesc: { fontSize: 13, color: colors.textSubtle, lineHeight: 20, marginBottom: 16 },
  healthConnectBtn: { backgroundColor: colors.surfaceInverse, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  healthConnectBtnText: { fontSize: 14, fontWeight: '700', color: colors.surfaceRaised },
  healthStatusLabel: { fontSize: 32, fontWeight: '800', marginBottom: 14 },
  healthMetricsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  healthMetric: { flex: 1, backgroundColor: colors.surfaceInset, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  healthMetricVal: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  healthMetricLabel: { fontSize: 10, color: colors.textSubtle },
  healthAdvice: { fontSize: 13, color: colors.textMuted, lineHeight: 19, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border },
  healthSourceRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  healthSourceName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  healthSourceDesc: { fontSize: 12, color: colors.textSubtle, lineHeight: 17 },
  healthDisconnectBtn: { marginHorizontal: 20, marginTop: 14, paddingVertical: 14, alignItems: 'center' },
  healthDisconnectText: { fontSize: 13, color: colors.textSubtle },
});
