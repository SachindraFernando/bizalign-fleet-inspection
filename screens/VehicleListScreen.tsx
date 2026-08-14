import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useInspectionStore, Vehicle } from '../store/useInspectionStore';

type Props = {
  onSelectVehicle: (vehicle: Vehicle) => void;
};

export default function VehicleListScreen({ onSelectVehicle }: Props) {
  const vehicles = useInspectionStore((state) => state.vehicles);
  const inspections = useInspectionStore((state) => state.inspections);

  function getStatusLabel(vehicleId: string) {
    const vehicleInspections = inspections.filter(
      (i) => i.vehicleId === vehicleId
    );
    if (vehicleInspections.length === 0) return null;

    const hasPending = vehicleInspections.some(
      (i) => i.status === 'pending' || i.status === 'syncing' || i.status === 'failed'
    );
    return hasPending ? 'Waiting to sync' : 'Synced';
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vehicles</Text>
      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const status = getStatusLabel(item.id);
          return (
            <Pressable style={styles.card} onPress={() => onSelectVehicle(item)}>
              <Text style={styles.registration}>{item.registration}</Text>
              <Text style={styles.model}>
                {item.make} {item.model}
              </Text>
              {status && (
                <Text
                  style={[
                    styles.status,
                    status === 'Synced' ? styles.synced : styles.pending,
                  ]}
                >
                  {status}
                </Text>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20, paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  registration: { fontSize: 18, fontWeight: '600' },
  model: { fontSize: 14, color: '#555', marginTop: 2 },
  status: { marginTop: 6, fontSize: 12, fontWeight: '600' },
  synced: { color: 'green' },
  pending: { color: '#c77700' },
});