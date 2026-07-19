import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StatusBar,
  Dimensions,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Line } from 'react-native-svg';

const STORAGE_KEY = '@betting_tracker_data_v4';
const SCREEN_WIDTH = Dimensions.get('window').width;

// Helper per formattare i mesi in italiano
const MONTHS_IT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

// Helper per ottenere il numero della settimana dell'anno
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

export default function App() {
  // --- STATO DELLA NAVIGAZIONE TAB ---
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard' o 'reports'

  // --- STATO DATI ---
  const [bankrolls, setBankrolls] = useState([]);
  const [activeBankrollId, setActiveBankrollId] = useState('');
  
  // Stati di espansione per il Resoconto Temporale
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedWeeks, setExpandedWeeks] = useState({});

  // Modali
  const [isBankrollModalVisible, setIsBankrollModalVisible] = useState(false);
  const [isBetModalVisible, setIsBetModalVisible] = useState(false);
  const [isSelectorVisible, setIsSelectorVisible] = useState(false);
  
  // Form Bankroll
  const [newBankrollName, setNewBankrollName] = useState('');
  const [newBankrollBudget, setNewBankrollBudget] = useState('');
  
  // Form Scommessa
  const [editingBetId, setEditingBetId] = useState(null);
  const [betDescription, setBetDescription] = useState('');
  const [betStake, setBetStake] = useState('');
  const [betOdds, setBetOdds] = useState('');
  const [betStatus, setBetStatus] = useState('In corso');

  // --- CARICAMENTO DATI ---
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      if (jsonValue != null) {
        const parsed = JSON.parse(jsonValue);
        setBankrolls(parsed);
        if (parsed.length > 0) {
          setActiveBankrollId(parsed[0].id);
        }
      } else {
        const defaultBankroll = {
          id: 'bk-default',
          name: 'Strategia Calcio',
          initialBudget: 1000,
          bets: [
            { id: 'b1', description: 'Inter - Milan (1X)', stake: 50, odds: 1.65, status: 'Vinta', createdAt: Date.now() - 172800000 },
            { id: 'b2', description: 'Real Madrid - Barcellona', stake: 100, odds: 1.80, status: 'Persa', createdAt: Date.now() - 86400000 },
            { id: 'b3', description: 'Juventus - Roma (1)', stake: 40, odds: 2.10, status: 'In corso', createdAt: Date.now() }
          ]
        };
        setBankrolls([defaultBankroll]);
        setActiveBankrollId(defaultBankroll.id);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([defaultBankroll]));
      }
    } catch (e) {
      console.log(e);
    }
  };

  const saveData = async (updatedBankrolls) => {
    try {
      setBankrolls(updatedBankrolls);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedBankrolls));
    } catch (e) {
      console.log(e);
    }
  };

  const activeBankroll = useMemo(() => {
    return bankrolls.find(b => b.id === activeBankrollId) || null;
  }, [bankrolls, activeBankrollId]);

  // --- AZIONI FORM ---
  const handleCreateBankroll = () => {
    if (!newBankrollName.trim() || !newBankrollBudget.trim()) return alert("Compila tutto.");
    const budget = parseFloat(newBankrollBudget);
    if (isNaN(budget) || budget <= 0) return alert("Budget invalido.");

    const newBk = { id: Math.random().toString(36).substring(2, 9), name: newBankrollName.trim(), initialBudget: budget, bets: [] };
    const updated = [...bankrolls, newBk];
    saveData(updated);
    setActiveBankrollId(newBk.id);
    setIsBankrollModalVisible(false);
    setNewBankrollName('');
    setNewBankrollBudget('');
  };

  const handleDeleteBankroll = (id) => {
    if (bankrolls.length <= 1) return alert("Tieni almeno un bankroll attivo.");
    const updated = bankrolls.filter(b => b.id !== id);
    if (activeBankrollId === id) setActiveBankrollId(updated[0].id);
    saveData(updated);
    setIsSelectorVisible(false);
  };

  const handleSaveBet = () => {
    if (!betDescription.trim() || !betStake.trim() || !betOdds.trim()) return alert("Compila tutti i campi.");
    const stake = parseFloat(betStake);
    const odds = parseFloat(betOdds);
    if (isNaN(stake) || stake <= 0 || isNaN(odds) || odds <= 1) return alert("Valori errati.");

    let updatedBets = [...(activeBankroll?.bets || [])];

    if (editingBetId) {
      updatedBets = updatedBets.map(b => b.id === editingBetId ? { ...b, description: betDescription.trim(), stake, odds, status: betStatus } : b);
    } else {
      updatedBets.unshift({ id: Math.random().toString(36).substring(2, 9), description: betDescription.trim(), stake, odds, status: betStatus, createdAt: Date.now() });
    }

    const updatedBankrolls = bankrolls.map(b => b.id === activeBankrollId ? { ...b, bets: updatedBets } : b);
    saveData(updatedBankrolls);
    closeBetModal();
  };

  const openEditBetModal = (bet) => {
    setEditingBetId(bet.id);
    setBetDescription(bet.description);
    setBetStake(bet.stake.toString());
    setBetOdds(bet.odds.toString());
    setBetStatus(bet.status);
    setIsBetModalVisible(true);
  };

  const handleDeleteBet = (betId) => {
    const updatedBets = activeBankroll.bets.filter(b => b.id !== betId);
    const updatedBankrolls = bankrolls.map(b => b.id === activeBankrollId ? { ...b, bets: updatedBets } : b);
    saveData(updatedBankrolls);
  };

  const closeBetModal = () => {
    setIsBetModalVisible(false);
    setEditingBetId(null);
    setBetDescription('');
    setBetStake('');
    setBetOdds('');
    setBetStatus('In corso');
  };

  // --- CALCOLO METRICHE GENERALI ---
  const metrics = useMemo(() => {
    if (!activeBankroll) return { currentBudget: 0, availableCash: 0, netProfit: 0, roi: 0, winRate: 0, avgOdds: 0, avgStake: 0, monthlyProfit: 0 };
    const initial = activeBankroll.initialBudget;
    let netProfit = 0, lockedCash = 0, wonCount = 0, resolvedCount = 0, totalInvestedResolved = 0, sumOdds = 0, sumStake = 0, monthlyProfit = 0;
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    activeBankroll.bets.forEach(bet => {
      sumOdds += bet.odds;
      sumStake += bet.stake;
      let p = 0;
      if (bet.status === 'In corso') lockedCash += bet.stake;
      else if (bet.status === 'Vinta') { p = (bet.stake * bet.odds) - bet.stake; netProfit += p; wonCount++; resolvedCount++; totalInvestedResolved += bet.stake; }
      else if (bet.status === 'Persa') { p = -bet.stake; netProfit += p; resolvedCount++; totalInvestedResolved += bet.stake; }
      
      if (bet.createdAt >= thirtyDaysAgo) monthlyProfit += p;
    });

    return {
      currentBudget: initial + netProfit, availableCash: initial + netProfit - lockedCash, netProfit,
      roi: totalInvestedResolved > 0 ? (netProfit / totalInvestedResolved) * 100 : 0,
      winRate: resolvedCount > 0 ? (wonCount / resolvedCount) * 100 : 0,
      avgOdds: activeBankroll.bets.length > 0 ? sumOdds / activeBankroll.bets.length : 0,
      avgStake: activeBankroll.bets.length > 0 ? sumStake / activeBankroll.bets.length : 0,
      monthlyProfit
    };
  }, [activeBankroll]);

  // --- LOGICA DI STRUTTURAZIONE ALBERO TEMPORALE (CRONOLOGIA COMPLESSA) ---
  const timeStructure = useMemo(() => {
    if (!activeBankroll) return [];
    const tree = {};

    activeBankroll.bets.forEach(bet => {
      const date = new Date(bet.createdAt);
      const year = date.getFullYear();
      const monthIdx = date.getMonth();
      const monthLabel = `${MONTHS_IT[monthIdx]} ${year}`;
      const weekLabel = `Settimana ${getWeekNumber(date)}`;
      const dayLabel = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

      let profit = 0;
      if (bet.status === 'Vinta') profit = (bet.stake * bet.odds) - bet.stake;
      else if (bet.status === 'Persa') profit = -bet.stake;

      if (!tree[monthLabel]) tree[monthLabel] = { profit: 0, weeks: {} };
      tree[monthLabel].profit += profit;

      if (!tree[monthLabel].weeks[weekLabel]) tree[monthLabel].weeks[weekLabel] = { profit: 0, days: {} };
      tree[monthLabel].weeks[weekLabel].profit += profit;

      if (!tree[monthLabel].weeks[weekLabel].days[dayLabel]) tree[monthLabel].weeks[weekLabel].days[dayLabel] = { profit: 0, bets: [] };
      tree[monthLabel].weeks[weekLabel].days[dayLabel].profit += profit;
      tree[monthLabel].weeks[weekLabel].days[dayLabel].bets.push(bet);
    });

    return Object.keys(tree).map(mKey => ({
      name: mKey,
      profit: tree[mKey].profit,
      weeks: Object.keys(tree[mKey].weeks).map(wKey => ({
        name: wKey,
        profit: tree[mKey].weeks[wKey].profit,
        days: Object.keys(tree[mKey].weeks[wKey].days).map(dKey => ({
          name: dKey,
          profit: tree[mKey].weeks[wKey].days[dKey].profit,
          bets: tree[mKey].weeks[wKey].days[dKey].bets
        }))
      }))
    }));
  }, [activeBankroll]);

  // Toggles per i menu a tendina temporali
  const toggleMonth = (name) => setExpandedMonths(prev => ({ ...prev, [name]: !prev[name] }));
  const toggleWeek = (name) => setExpandedWeeks(prev => ({ ...prev, [name]: !prev[name] }));

  // --- GRAFICO LINEARE ---
  const renderChart = () => {
    if (!activeBankroll || activeBankroll.bets.length === 0) return <View style={styles.emptyChartContainer}><Text style={styles.emptyText}>Nessun dato per il grafico</Text></View>;
    const sortedBets = [...activeBankroll.bets].reverse();
    let curr = activeBankroll.initialBudget;
    const hist = [curr];
    sortedBets.forEach(b => {
      if (b.status === 'Vinta') curr += (b.stake * b.odds) - b.stake;
      else if (b.status === 'Persa') curr -= b.stake;
      if (b.status === 'Vinta' || b.status === 'Persa') hist.push(curr);
    });
    if (hist.length === 1) return <View style={styles.emptyChartContainer}><Text style={styles.emptyText}>Nessuna scommessa conclusa</Text></View>;

    const chartHeight = 130;
    const ptW = Math.max(65, (SCREEN_WIDTH - 32) / (hist.length - 1));
    const totalW = ptW * (hist.length - 1) + 40;
    const min = Math.min(...hist), max = Math.max(...hist), rng = max - min === 0 ? 100 : max - min;
    const pts = hist.map((v, i) => ({ x: 20 + i * ptW, y: 20 + ((chartHeight - 40) * (1 - (v - min) / rng)) }));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScrollView}>
        <View style={{ width: totalW, height: chartHeight }}>
          <Svg width={totalW} height={chartHeight}>
            <Line x1="0" y1={chartHeight / 2} x2={totalW} y2={chartHeight / 2} stroke="#222" strokeDasharray="4 4" />
            <Path d={d} fill="none" stroke={metrics.netProfit >= 0 ? '#4CD964' : '#FF3B30'} strokeWidth="3" />
            {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r="4" fill="#141417" stroke={metrics.netProfit >= 0 ? '#4CD964' : '#FF3B30'} strokeWidth="2" />)}
          </Svg>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />
      
      {/* HEADER BAR COMUNE */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.selectorTrigger} onPress={() => setIsSelectorVisible(true)}>
          <Text style={styles.selectorLabel}>PORTAFOGLIO ATTIVO</Text>
          <Text style={styles.selectorValue} numberOfLines={1}>{activeBankroll ? activeBankroll.name : 'Seleziona...'} ▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBankrollBtn} onPress={() => setIsBankrollModalVisible(true)}>
          <Text style={styles.addBankrollBtnText}>+ Nuovo</Text>
        </TouchableOpacity>
      </View>

      {/* --- VISTA CONDIZIONALE DEI TAB --- */}
      {currentTab === 'dashboard' ? (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* DASHBOARD CARD */}
          <View style={styles.dashboardCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.metricLabel}>Budget Attuale</Text>
                <Text style={styles.budgetMain}>€ {metrics.currentBudget.toFixed(2)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.metricLabel}>Cassa Disponibile</Text>
                <Text style={styles.cashValue}>€ {metrics.availableCash.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}><Text style={styles.metricLabel}>Profitto Netto</Text><Text style={[styles.subMetricValue, metrics.netProfit >= 0 ? styles.positiveText : styles.negativeText]}>{metrics.netProfit >= 0 ? '+' : ''}{metrics.netProfit.toFixed(2)}€</Text></View>
              <View style={{ flex: 1, alignItems: 'center' }}><Text style={styles.metricLabel}>ROI</Text><Text style={[styles.subMetricValue, metrics.roi >= 0 ? styles.positiveText : styles.negativeText]}>{metrics.roi >= 0 ? '+' : ''}{metrics.roi.toFixed(1)}%</Text></View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={styles.metricLabel}>Win Rate</Text><Text style={[styles.subMetricValue, { color: '#FFF' }]}>{metrics.winRate.toFixed(0)}%</Text></View>
            </View>
            <View style={styles.divider} />
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}><Text style={styles.extraMetricLabel}>Quota Media</Text><Text style={styles.extraMetricValue}>{metrics.avgOdds.toFixed(2)}</Text></View>
              <View style={{ flex: 1, alignItems: 'center' }}><Text style={styles.extraMetricLabel}>Stake Medio</Text><Text style={styles.extraMetricValue}>€{metrics.avgStake.toFixed(1)}</Text></View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={styles.extraMetricLabel}>Profitto 30g</Text><Text style={[styles.extraMetricValue, metrics.monthlyProfit >= 0 ? styles.positiveText : styles.negativeText]}>{metrics.monthlyProfit >= 0 ? '+' : ''}€{metrics.monthlyProfit.toFixed(1)}</Text></View>
            </View>
          </View>

          {/* GRAFICO E SCOMMESSE CORRENTI */}
          <Text style={styles.sectionTitle}>Andamento Capitale</Text>
          {renderChart()}

          <Text style={styles.sectionTitle}>Scommesse ({activeBankroll?.bets.length || 0})</Text>
          {activeBankroll?.bets.map((bet) => {
            let col = '#AEAEB2'; let bg = '#2C2C2E';
            if (bet.status === 'Vinta') { col = '#30D158'; bg = 'rgba(48,209,88,0.15)'; }
            if (bet.status === 'Persa') { col = '#FF453A'; bg = 'rgba(255,69,58,0.15)'; }
            if (bet.status === 'Rimborsata') { col = '#BF5AF2'; bg = 'rgba(191,90,242,0.15)'; }

            return (
              <TouchableOpacity key={bet.id} style={styles.betCard} onPress={() => openEditBetModal(bet)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.betDescription}>{bet.description}</Text>
                  <View style={{ flexDirection: 'row', marginTop: 4 }}>
                    <Text style={styles.betDetailText}>Stake: <Text style={{color:'#FFF'}}>€{bet.stake}</Text></Text>
                    <Text style={styles.betDetailText}>Quota: <Text style={{color:'#FFF'}}>{bet.odds}</Text></Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: bg }]}>
                  <Text style={{ color: col, fontWeight: '700', fontSize: 12 }}>{bet.status}</Text>
                </View>
                <TouchableOpacity style={{marginLeft: 12, padding: 4}} onPress={() => handleDeleteBet(bet.id)}>
                  <Text style={{color: '#FF453A', fontSize: 12}}>Elimina</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        // --- NUOVA SCHERMATA: RESOCONTO CRONOLOGICO TEMPORALE ---
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Analisi Guadagni / Perdite</Text>
          {timeStructure.length === 0 ? (
            <Text style={styles.emptyText}>Nessuna scommessa salvata per estrarre resoconti storici.</Text>
          ) : (
            timeStructure.map(month => (
              <View key={month.name} style={styles.timeBlock}>
                {/* RIGA MESE */}
                <TouchableOpacity style={styles.timeHeaderRow} onPress={() => toggleMonth(month.name)}>
                  <Text style={styles.timeHeaderTitle}>{month.name} {expandedMonths[month.name] ? '▴' : '▾'}</Text>
                  <Text style={[styles.timeHeaderProfit, month.profit >= 0 ? styles.positiveText : styles.negativeText]}>
                    {month.profit >= 0 ? '+' : ''}€{month.profit.toFixed(2)}
                  </Text>
                </TouchableOpacity>

                {/* CONTENUTO SETTIMANE */}
                {expandedMonths[month.name] && month.weeks.map(week => (
                  <View key={week.name} style={{ marginLeft: 12, marginTop: 4 }}>
                    <TouchableOpacity style={styles.weekHeaderRow} onPress={() => toggleWeek(week.name)}>
                      <Text style={styles.weekHeaderTitle}>{week.name} {expandedWeeks[week.name] ? '▴' : '▾'}</Text>
                      <Text style={[styles.weekHeaderProfit, week.profit >= 0 ? styles.positiveText : styles.negativeText]}>
                        {week.profit >= 0 ? '+' : ''}€{week.profit.toFixed(2)}
                      </Text>
                    </TouchableOpacity>

                    {/* CONTENUTO GIORNI E DETTAGLI RAPIDI */}
                    {expandedWeeks[week.name] && week.days.map(day => (
                      <View key={day.name} style={styles.dayContainer}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.dayTitle}>{day.name}</Text>
                          <Text style={[styles.dayProfitText, day.profit >= 0 ? styles.positiveText : styles.negativeText]}>
                            {day.profit >= 0 ? '+' : ''}€{day.profit.toFixed(2)}
                          </Text>
                        </View>
                        
                        {/* LISTA DELLE SCOMMESSE DEL GIORNO */}
                        {day.bets.map(b => (
                          <View key={b.id} style={styles.miniBetItem}>
                            <Text style={{color:'#FFF', fontSize:13, flex:1}} numberOfLines={1}>{b.description}</Text>
                            <Text style={{color:'#8E8E93', fontSize:12, marginRight: 8}}>x{b.odds}</Text>
                            <Text style={{
                              fontSize: 12, 
                              fontWeight: '600', 
                              color: b.status === 'Vinta' ? '#30D158' : b.status === 'Persa' ? '#FF453A' : '#AEAEB2'
                            }}>
                              €{b.stake} ({b.status})
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* FAB FLUTTUANTE AGGIUNGI (Sempre disponibile nella dashboard) */}
      {currentTab === 'dashboard' && (
        <TouchableOpacity style={styles.fab} onPress={() => setIsBetModalVisible(true)}>
          <Text style={{ fontSize: 30, color: '#FFF' }}>+</Text>
        </TouchableOpacity>
      )}

      {/* --- TAB BAR INFERIORE DI NAVIGAZIONE --- */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabBarItem} onPress={() => setCurrentTab('dashboard')}>
          <Text style={[styles.tabBarText, currentTab === 'dashboard' && styles.tabBarTextActive]}>📊 Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabBarItem} onPress={() => setCurrentTab('reports')}>
          <Text style={[styles.tabBarText, currentTab === 'reports' && styles.tabBarTextActive]}>📅 Resoconto</Text>
        </TouchableOpacity>
      </View>

      {/* MODALE SELETTORE BANKROLL */}
      <Modal visible={isSelectorVisible} animationType="slide" transparent={true}>
        <TouchableWithoutFeedback onPress={() => setIsSelectorVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.bottomSheetContainer}>
              <Text style={styles.modalTitle}>Seleziona Portafoglio</Text>
              {bankrolls.map(bk => (
                <View key={bk.id} style={styles.selectorRow}>
                  <TouchableOpacity style={{flex:1}} onPress={() => { setActiveBankrollId(bk.id); setIsSelectorVisible(false); }}>
                    <Text style={{color: activeBankrollId === bk.id ? '#007AFF' : '#FFF', fontSize: 16}}>{bk.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteBankroll(bk.id)}>
                    <Text style={{color: '#FF453A'}}>Elimina</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* MODALE NUOVO BANKROLL */}
      <Modal visible={isBankrollModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Text style={styles.modalTitle}>Nuovo Portafoglio</Text>
            <TextInput style={styles.input} placeholder="Nome Portafoglio" placeholderTextColor="#666" value={newBankrollName} onChangeText={setNewBankrollName} />
            <TextInput style={styles.input} placeholder="Budget Iniziale (€)" placeholderTextColor="#666" keyboardType="numeric" value={newBankrollBudget} onChangeText={setNewBankrollBudget} />
            <View style={{flexDirection:'row', marginTop: 10}}>
              <TouchableOpacity style={[styles.btn, {backgroundColor:'#2C2C2E'}]} onPress={() => setIsBankrollModalVisible(false)}><Text style={{color:'#FF453A'}}>Chiudi</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, {backgroundColor:'#007AFF'}]} onPress={handleCreateBankroll}><Text style={{color:'#FFF'}}>Crea</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODALE INSERIMENTO SCOMMESSA */}
      <Modal visible={isBetModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.bottomSheetContainer}>
            <Text style={styles.modalTitle}>{editingBetId ? 'Modifica Giocata' : 'Nuova Scommessa'}</Text>
            <TextInput style={styles.input} placeholder="Evento (es: Milan - Inter)" placeholderTextColor="#666" value={betDescription} onChangeText={setBetDescription} />
            <View style={styles.rowBetween}>
              <TextInput style={[styles.input, {width:'48%'}]} placeholder="Stake (€)" placeholderTextColor="#666" keyboardType="numeric" value={betStake} onChangeText={setBetStake} />
              <TextInput style={[styles.input, {width:'48%'}]} placeholder="Quota" placeholderTextColor="#666" keyboardType="numeric" value={betOdds} onChangeText={setBetOdds} />
            </View>
            <View style={{flexDirection:'row', justifyContent:'space-between', width:'100%', marginVertical: 10}}>
              {['In corso', 'Vinta', 'Persa', 'Rimborsata'].map(st => (
                <TouchableOpacity key={st} style={[styles.badgeOption, betStatus === st && {backgroundColor:'#007AFF'}]} onPress={() => setBetStatus(st)}>
                  <Text style={{color: betStatus === st ? '#FFF' : '#AAA', fontSize: 11}}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{flexDirection:'row', marginTop: 15}}>
              <TouchableOpacity style={[styles.btn, {backgroundColor:'#2C2C2E'}]} onPress={closeBetModal}><Text style={{color:'#FF453A'}}>Annulla</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, {backgroundColor:'#007AFF'}]} onPress={handleSaveBet}><Text style={{color:'#FFF'}}>Salva</Text></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0A0A0C', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10 },
  container: { flex: 1, paddingHorizontal: 16 },
  appBar: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1C1C1E', marginTop: 5 },
  selectorTrigger: { flex: 1 },
  selectorLabel: { fontSize: 10, color: '#8E8E93', fontWeight: '700' },
  selectorValue: { fontSize: 18, color: '#FFF', fontWeight: '600' },
  addBankrollBtn: { backgroundColor: '#1C1C1E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addBankrollBtnText: { color: '#007AFF', fontWeight: '600' },
  dashboardCard: { backgroundColor: '#141417', borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#1F1F24' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  metricLabel: { fontSize: 11, color: '#8E8E93' },
  extraMetricLabel: { fontSize: 11, color: '#636366', fontWeight: '600' },
  budgetMain: { fontSize: 26, fontWeight: '700', color: '#FFF' },
  cashValue: { fontSize: 18, fontWeight: '600', color: '#E5E5EA' },
  divider: { height: 1, backgroundColor: '#1F1F24', marginVertical: 12 },
  subMetricValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  extraMetricValue: { fontSize: 15, fontWeight: '600', color: '#E5E5EA', marginTop: 2 },
  positiveText: { color: '#30D158' },
  negativeText: { color: '#FF453A' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#8E8E93', marginTop: 20, marginBottom: 10, textTransform: 'uppercase' },
  emptyChartContainer: { height: 130, backgroundColor: '#141417', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  chartScrollView: { backgroundColor: '#141417', borderRadius: 16 },
  betCard: { backgroundColor: '#141417', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1F1F24' },
  betDescription: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  betDetailText: { fontSize: 12, color: '#8E8E93', marginRight: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, minWidth: 75, alignItems: 'center' },
  fab: { position: 'absolute', bottom: 75, right: 20, backgroundColor: '#007AFF', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  
  // STILI DELLA STRUTTURA TEMPORALE (REPORTS SCHERMATA)
  timeBlock: { backgroundColor: '#141417', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#1F1F24' },
  timeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  timeHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  timeHeaderProfit: { fontSize: 16, fontWeight: '700' },
  weekHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#2C2C2E', marginTop: 4 },
  weekHeaderTitle: { fontSize: 14, color: '#E5E5EA', fontWeight: '600' },
  weekHeaderProfit: { fontSize: 14, fontWeight: '600' },
  dayContainer: { backgroundColor: '#1C1C1E', borderRadius: 8, padding: 10, marginTop: 6, marginLeft: 8 },
  dayTitle: { fontSize: 13, fontWeight: '600', color: '#007AFF' },
  dayProfitText: { fontSize: 13, fontWeight: '700' },
  miniBetItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingVertical: 4, borderTopWidth: 0.3, borderTopColor: '#3A3A3C' },
  emptyText: { color: '#48484A', fontSize: 14, textAlign: 'center', marginTop: 20 },

  // STILI TAB BAR INFERIORE
  bottomTabBar: { height: 60, backgroundColor: '#141417', flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1C1C1E', justifyContent: 'space-around', alignItems: 'center' },
  tabBarItem: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  tabBarText: { color: '#8E8E93', fontSize: 14, fontWeight: '500' },
  tabBarTextActive: { color: '#007AFF', fontWeight: '700' },

  // COMPONENTI DEI MODALI GLOBALI
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  bottomSheetContainer: { backgroundColor: '#1C1C1E', width: '100%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, alignItems: 'center' },
  alertModal: { backgroundColor: '#1C1C1E', width: '90%', borderRadius: 12, padding: 20, alignSelf: 'center', marginBottom: 'auto', marginTop: '30%', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 15 },
  input: { backgroundColor: '#2C2C2E', width: '100%', height: 45, borderRadius: 8, paddingHorizontal: 12, color: '#FFF', marginBottom: 10 },
  badgeOption: { flex: 1, backgroundColor: '#2C2C2E', paddingVertical: 8, marginHorizontal: 2, borderRadius: 6, alignItems: 'center' },
  btn: { flex: 1, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginHorizontal: 5 },
  selectorRow: { flexDirection: 'row', width: '100%', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2C2C2E', justifyContent: 'space-between' }
});
