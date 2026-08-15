import { useState } from 'react';
import {
  View,
  Text,
  Switch,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { createInspection } from '../store/sync';
import { syncAllPending } from '../store/sync';
import { Vehicle } from '../store/useInspectionStore';

type Props = {
  vehicle: Vehicle;
  onDone: () => void;
};

const CHECKS = [
  { key: 'tyres', label: 'Tyres' },
  { key: 'lights', label: 'Lights' },
  { key: 'fluidLevels', label: 'Fluid levels' },
  { key: 'mirrors', label: 'Mirrors' },
  { key: 'brakes', label: 'Brakes' },
  { key: 'bodywork', label: 'Bodywork damage' },
] as const;

export default function InspectionFormScreen({ vehicle, onDone }: Props) {
  // All 6 checks default to "pass" — the assumption is a driver mostly
  // reports exceptions rather than confirming everything is fine one by
  // one. Documented as a judgement call in the write-up.
  const [answers, setAnswers] = useState({
    tyres: true,
    lights: true,
    fluidLevels: true,
    mirrors: true,
    brakes: true,
    bodywork: true,
  });
  const [notes, setNotes] = useState('');

  function toggle(key: keyof typeof answers) {
    setAnswers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSubmit() {
    // Saves locally first — always succeeds, regardless of network state.
    createInspection(vehicle.id, { ...answers, notes });
    // Then optimistically try syncing immediately, in case we do have a
    // connection right now. If not, this call just fails quietly and the
    // inspection stays "pending" — it'll be picked up automatically by
    // the NetInfo listener or the periodic retry in store/init.ts.
    syncAllPending();
    onDone();
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        {vehicle.registration} — {vehicle.make} {vehicle.model}
      </Text>

      {CHECKS.map(({ key, label }) => (
        <View key={key} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Switch value={answers[key]} onValueChange={() => toggle(key)} />
        </View>
      ))}

      <Text style={styles.notesLabel}>Notes</Text>
      <TextInput
        style={styles.notesInput}
        multiline
        value={notes}
        onChangeText={setNotes}
        placeholder="Any additional notes..."
      />

      <View style={styles.buttonRow}>
        <Button title="Cancel" onPress={onDone} color="#888" />
        <Button title="Submit" onPress={handleSubmit} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: { fontSize: 16 },
  notesLabel: { fontSize: 16, fontWeight: '600', marginTop: 20 },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 40,
  },
});