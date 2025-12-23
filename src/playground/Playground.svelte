<script lang="ts">  
  import { 
    getAllDailyNotes, 
    getDailyNote 
  } from 'obsidian-daily-notes-interface';
  import { moment } from 'obsidian';

  function getTodayNote() {
    return getDailyNote(moment(), getAllDailyNotes());
  }

  async function getTodayContents() {
    const dailyNoteFile = getTodayNote();

    if (dailyNoteFile) {
      const content = await this.app.vault.read(dailyNoteFile);
      console.log(content);
      return content;
    } else {
      return "No daily note found"
    }
  } 

  const contentPromise = getTodayContents();
  let content = $state('');

  function updateToday(value: string) {
    try {
      this.app.vault.modify(getTodayNote, value);
    } catch (e) {
      console.error("Save failed", e)
    }
  }

  $effect(() => {
    updateToday(content);
  });
 
</script>