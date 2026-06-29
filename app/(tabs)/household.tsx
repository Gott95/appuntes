import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { useAuthContext } from '@/lib/auth-context';
import { Colors } from '@/lib/theme';
import { formatCurrency, getCurrentMonth, getMonthFullName, getMonthRange } from '@/lib/utils';
import { useHousehold } from '@/hooks/useHousehold';
import { HouseholdMember, logActivity, getSharedTransactions, getSharedExpenses, getSharedSavingsGoals } from '@/lib/household';
import { useChatMessages, sendMessage, useActivityFeed } from '@/lib/household-chat';
import { getProgressPercent } from '@/lib/savings';
import { supabase } from '@/lib/supabase';

type ViewMode = 'setup' | 'dashboard' | 'members' | 'settings' | 'chat';

export default function HouseholdScreen() {
  const { user } = useAuthContext();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const {
    household, members, loading, isAdmin,
    createHousehold, joinHousehold, updateSettings,
    removeMember, leaveHousehold, deleteHousehold, refresh,
  } = useHousehold();

  const [view, setView] = useState<ViewMode>('setup');
  const [newName, setNewName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  const householdId = household?.id || null;
  const { messages, loading: chatLoading, loadMessages } = useChatMessages(view === 'chat' ? householdId : null);
  const { activities } = useActivityFeed(householdId);
  const [chatInput, setChatInput] = useState('');

  const [sharedTransactions, setSharedTransactions] = useState<any[]>([]);
  const [sharedExpenses, setSharedExpenses] = useState<any[]>([]);
  const [sharedGoals, setSharedGoals] = useState<any[]>([]);
  const [totalSharedSpent, setTotalSharedSpent] = useState(0);

  const { month, year } = getCurrentMonth();

  useEffect(() => {
    if (household) setView('dashboard');
  }, [household]);

  useEffect(() => {
    if (view === 'dashboard' && household) {
      loadData();
    }
  }, [view, household]);

  const loadData = async () => {
    if (!household) return;
    const { startDate, endDate } = getMonthRange(month, year);
    const [trans, exp, goals] = await Promise.all([
      getSharedTransactions(household.id, startDate, endDate),
      getSharedExpenses(household.id),
      getSharedSavingsGoals(household.id),
    ]);
    setSharedTransactions(trans);
    setSharedExpenses(exp);
    setSharedGoals(goals);
    const total = trans.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);
    setTotalSharedSpent(total);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para el hogar');
      return;
    }
    try {
      const hh = await createHousehold(newName.trim());
      if (hh) {
        setNewName('');
        setShowInviteModal(true);
      } else {
        Alert.alert('Error', 'No se pudo crear el hogar. Verifica que ejecutaste el SQL correctamente.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo crear el hogar');
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim() || inviteCode.trim().length !== 6) {
      Alert.alert('Error', 'Ingresa un código de 6 caracteres');
      return;
    }
    try {
      const hh = await joinHousehold(inviteCode.trim().toUpperCase());
      if (hh) {
        setInviteCode('');
        Alert.alert('Listo', `Te uniste a "${hh.name}"`);
      } else {
        Alert.alert('Error', 'Código inválido o hogar no encontrado');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo unir al hogar');
    }
  };

  const handleSendMessage = async () => {
    if (!user || !household || !chatInput.trim()) return;
    const ok = await sendMessage(household.id, user.id, chatInput.trim());
    if (ok) {
      setChatInput('');
      logActivity(household.id, user.id, 'chat_message', { preview: chatInput.trim().slice(0, 50) });
    }
  };

  const handleToggleSetting = async (key: string) => {
    if (!household || !isAdmin) return;
    const current = (household.settings as any)[key];
    await updateSettings({ [key]: !current });
  };

  const handleRemoveMember = (member: HouseholdMember) => {
    const email = (member.profiles as any)?.email || 'Desconocido';
    Alert.alert('Expulsar miembro', `¿Expulsar a ${email}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Expulsar',
        style: 'destructive',
        onPress: () => removeMember(member.user_id),
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Cargando...</Text>
      </View>
    );
  }

  if (!household) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: 52 }]}>
          <Text style={[styles.headerTitle, { color: colors.surface }]}>🏠 Modo Pareja / Familia</Text>
        </View>
        <ScrollView contentContainerStyle={styles.setupContainer}>
          <Text style={[styles.setupSubtitle, { color: colors.textSecondary }]}>
            Crea un hogar o únete a uno existente para compartir finanzas con tu pareja o familia.
          </Text>

          <View style={[styles.setupCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.setupCardTitle, { color: colors.text }]}>Crear hogar</Text>
            <Text style={[styles.setupCardDesc, { color: colors.textSecondary }]}>
              Crea un hogar y comparte el código de invitación
            </Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceVariant }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nombre del hogar (ej: Los García)"
              placeholderTextColor={colors.textTertiary}
            />
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleCreate}>
              <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Crear hogar</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.setupCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.setupCardTitle, { color: colors.text }]}>Unirse a hogar</Text>
            <Text style={[styles.setupCardDesc, { color: colors.textSecondary }]}>
              Ingresa el código de 6 caracteres que te compartieron
            </Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceVariant, textAlign: 'center', letterSpacing: 4, fontSize: 20, fontWeight: '700' }]}
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              placeholder="ABC123"
              placeholderTextColor={colors.textTertiary}
              maxLength={6}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleJoin}>
              <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Unirse</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  const email = (u: any) => u?.profiles?.email || 'Desconocido';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: 52 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.surface }]}>🏠 {household.name}</Text>
            <Text style={[styles.headerSub, { color: colors.surface + 'cc' }]}>
              {members.length} miembro{members.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {isAdmin && (
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowInviteModal(true)}>
              <Text style={[styles.headerBtnText, { color: colors.surface }]}>Invitar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        {(['dashboard', 'chat', 'members', 'settings'] as ViewMode[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, view === tab && { borderBottomColor: colors.primary }]}
            onPress={() => setView(tab)}
          >
            <Text style={[styles.tabText, { color: view === tab ? colors.primary : colors.textSecondary }]}>
              {tab === 'dashboard' ? 'Inicio' : tab === 'chat' ? 'Chat' : tab === 'members' ? 'Miembros' : 'Ajustes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Dashboard */}
      {view === 'dashboard' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Shared balance */}
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Gasto compartido este mes</Text>
            <Text style={[styles.cardAmount, { color: colors.text }]}>{formatCurrency(totalSharedSpent)}</Text>
          </View>

          {/* Members online */}
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Miembros</Text>
            <View style={styles.memberAvatars}>
              {members.map((m) => (
                <View key={m.id} style={[styles.avatarSmall, { backgroundColor: m.role === 'admin' ? colors.primary : colors.success }]}>
                  <Text style={styles.avatarSmallText}>{email(m).charAt(0).toUpperCase()}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Activity feed */}
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Actividad reciente</Text>
            {activities.length === 0 ? (
              <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', padding: 16 }}>Sin actividad aún</Text>
            ) : (
              activities.slice(0, 10).map((act) => (
                <View key={act.id} style={[styles.activityItem, { borderBottomColor: colors.borderLight }]}>
                  <Text style={[styles.activityUser, { color: colors.primary }]}>{email(act)}</Text>
                  <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                    {act.type === 'member_joined' && 'se unió al hogar'}
                    {act.type === 'chat_message' && `envió: "${act.data?.preview || ''}"`}
                    {act.type === 'expense_added' && `registró gasto: ${formatCurrency(act.data?.amount || 0)}`}
                    {act.type === 'goal_contribution' && `aportó ${formatCurrency(act.data?.amount || 0)} a meta`}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Chat */}
      {view === 'chat' && household.settings?.chat_enabled && (
        <View style={styles.chatContainer}>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatList}
            renderItem={({ item }) => {
              const isMe = item.user_id === user?.id;
              return (
                <View style={[styles.chatBubble, isMe ? styles.chatBubbleMe : styles.chatBubbleOther, { backgroundColor: isMe ? colors.primary : colors.surface }]}>
                  {!isMe && <Text style={[styles.chatSender, { color: colors.primary }]}>{email(item)}</Text>}
                  <Text style={[styles.chatText, { color: isMe ? '#fff' : colors.text }]}>{item.content}</Text>
                </View>
              );
            }}
          />
          <View style={[styles.chatInputBar, { backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}>
            <TextInput
              style={[styles.chatInput, { color: colors.text, backgroundColor: colors.surfaceVariant }]}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Escribe un mensaje..."
              placeholderTextColor={colors.textTertiary}
            />
            <TouchableOpacity style={[styles.chatSendBtn, { backgroundColor: colors.primary }]} onPress={handleSendMessage}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {view === 'chat' && !household.settings?.chat_enabled && (
        <View style={styles.center}>
          <Text style={{ color: colors.textTertiary }}>Chat desactivado por el admin</Text>
        </View>
      )}

      {/* Members */}
      {view === 'members' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {members.map((member) => (
            <View key={member.id} style={[styles.memberItem, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
              <View style={[styles.avatarSmall, { backgroundColor: member.role === 'admin' ? colors.primary : colors.success }]}>
                <Text style={styles.avatarSmallText}>{email(member).charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberEmail, { color: colors.text }]}>{email(member)}</Text>
                <Text style={[styles.memberRole, { color: member.role === 'admin' ? colors.primary : colors.textSecondary }]}>
                  {member.role === 'admin' ? 'Admin' : 'Miembro'}
                </Text>
              </View>
              {isAdmin && member.user_id !== user?.id && (
                <TouchableOpacity onPress={() => handleRemoveMember(member)}>
                  <Text style={{ color: colors.error, fontSize: 13 }}>Expulsar</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: colors.error + '12', marginTop: 20 }]} onPress={leaveHousehold}>
            <Text style={[styles.dangerBtnText, { color: colors.error }]}>Salir del hogar</Text>
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: colors.error + '12', marginTop: 8 }]} onPress={() => {
              Alert.alert('Eliminar hogar', 'Esto desvinculará a todos los miembros. ¿Continuar?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: deleteHousehold },
              ]);
            }}>
              <Text style={[styles.dangerBtnText, { color: colors.error }]}>Eliminar hogar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Settings (admin only) */}
      {view === 'settings' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {isAdmin ? (
            <>
              <Text style={[styles.settingsSection, { color: colors.textSecondary }]}>Funciones compartidas</Text>
              {[
                { key: 'shared_expenses', label: 'Gastos fijos compartidos', icon: '📌' },
                { key: 'shared_goals', label: 'Metas de ahorro compartidas', icon: '🎯' },
                { key: 'shared_budget', label: 'Presupuesto compartido', icon: '💰' },
                { key: 'chat_enabled', label: 'Chat del hogar', icon: '💬' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.settingItem, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}
                  onPress={() => handleToggleSetting(item.key)}
                >
                  <Text style={styles.settingIcon}>{item.icon}</Text>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{item.label}</Text>
                  <View style={[styles.toggle, { backgroundColor: (household.settings as any)?.[item.key] ? colors.primary : colors.surfaceVariant }]}>
                    <View style={[styles.toggleDot, { alignSelf: (household.settings as any)?.[item.key] ? 'flex-end' : 'flex-start' }]} />
                  </View>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 40 }}>
              Solo el admin puede gestionar los ajustes
            </Text>
          )}
        </ScrollView>
      )}

      {/* Invite modal */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowInviteModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Código de invitación</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Comparte este código con tu pareja para que se una
            </Text>
            <Text style={[styles.inviteCode, { color: colors.primary, backgroundColor: colors.surfaceVariant }]}>
              {household.invite_code}
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={() => {
                Alert.alert('Código copiado', household.invite_code);
              }}
            >
              <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Copiar código</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 8 }]} onPress={() => setShowInviteModal(false)}>
              <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  headerBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  headerBtnText: { fontSize: 13, fontWeight: '700' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '600' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  setupContainer: { padding: 24, paddingBottom: 60 },
  setupSubtitle: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  setupCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  setupCardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  setupCardDesc: { fontSize: 13, marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12 },
  primaryBtn: { borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', padding: 12 },
  secondaryBtnText: { fontSize: 14, fontWeight: '600' },
  dangerBtn: { borderRadius: 12, padding: 14, alignItems: 'center' },
  dangerBtnText: { fontSize: 14, fontWeight: '700' },
  card: { borderRadius: 16, padding: 18, marginBottom: 12 },
  cardLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  cardAmount: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  memberAvatars: { flexDirection: 'row', gap: 8, marginTop: 8 },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarSmallText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  memberItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  memberEmail: { fontSize: 14, fontWeight: '600' },
  memberRole: { fontSize: 12, marginTop: 2 },
  activityItem: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  activityUser: { fontSize: 13, fontWeight: '700', marginRight: 6 },
  activityText: { fontSize: 13, flex: 1 },
  settingsSection: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginTop: 8 },
  settingItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  settingIcon: { fontSize: 20, marginRight: 12 },
  settingLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  toggle: { width: 48, height: 28, borderRadius: 14, padding: 2, justifyContent: 'center' },
  toggleDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  chatContainer: { flex: 1 },
  chatList: { padding: 16, paddingBottom: 8 },
  chatBubble: { maxWidth: '75%', padding: 12, borderRadius: 16, marginBottom: 8 },
  chatBubbleMe: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  chatBubbleOther: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  chatSender: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  chatText: { fontSize: 14 },
  chatInputBar: { flexDirection: 'row', padding: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  chatInput: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14 },
  chatSendBtn: { paddingHorizontal: 18, borderRadius: 20, justifyContent: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalDesc: { fontSize: 13, marginBottom: 20 },
  inviteCode: { fontSize: 32, fontWeight: '800', textAlign: 'center', padding: 20, borderRadius: 16, letterSpacing: 8 },
});
