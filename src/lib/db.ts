import Dexie, { Table } from 'dexie';
import { Note, AppSettings } from './types';
import { DEFAULT_TOPIC_RULES } from './classify'; // Import from classify.ts

class AppDB extends Dexie {
  notes!: Table<Note, string>;
  settings!: Table<AppSettings & { id: string }, string>;

  constructor() {
    super('selfdev-db');
    this.setupSchema();
  }

  private setupSchema() {
    // Version 1: Initial schema definition.
    // Future schema changes will involve incrementing the version number
    // and providing an upgrade function.
    this.version(1).stores({
      // 'notes' table indexes:
      // 'id': Primary key
      // 'createdAt': For sorting by creation time
      // '*topics': Multi-entry index for searching by topic
      // 'favorite', 'sourceType': For filtering
      notes: 'id, createdAt, *topics, favorite, sourceType',
      
      // 'settings' table:
      // 'id': Primary key, expecting a single 'default' entry
      settings: 'id'
    });
  }

  /**
   * Populates the database with initial default settings if it's empty.
   * This ensures the app has a valid configuration on first launch.
   */
  async populateDefaultSettings() {
    await this.transaction('rw', this.settings, async () => {
      const settingsCount = await this.settings.count();
      if (settingsCount === 0) {
        console.log('Initializing default settings...');
        await this.settings.add({
          id: 'default',
          topicRules: DEFAULT_TOPIC_RULES, // Use imported default rules
          theme: 'light',
          defaultTopics: ['Productivity', 'Learning', 'Mindset', 'Health', 'Finance', 'Career', 'Tech', 'Relationships', 'Fitness', 'Creativity', 'Other']
        });
      }
    });
  }
}

// Create a singleton instance of the database.
const dbInstance = new AppDB();

// When the database is ready, populate it with default settings.
dbInstance.on('ready', async () => {
  try {
    await dbInstance.populateDefaultSettings();
  } catch (error) {
    console.error("Failed to populate default settings:", error);
  }
});

export const db = dbInstance;
