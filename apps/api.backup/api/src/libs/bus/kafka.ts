import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'chai-vc-platform',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

export const producer = kafka.producer();
export const consumer = kafka.consumer({ groupId: 'verify-workers' });

export async function start() {
  await producer.connect();
  (global as any).__kafka_producer_ok = true;
  await consumer.connect();
  (global as any).__kafka_consumer_ok = true;
}

export async function shutdown() {
  await consumer.disconnect();
  await producer.disconnect();
}

