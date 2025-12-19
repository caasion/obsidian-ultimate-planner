<script lang="ts">  
  import { 
    getAllDailyNotes, 
    getDailyNote 
  } from 'obsidian-daily-notes-interface';
  import { moment } from 'obsidian';

  async function getTodayContents() {
    const dailyNotes = getAllDailyNotes();

    const dailyNoteFile = getDailyNote(moment(), dailyNotes);

    if (dailyNoteFile) {
      const content = await this.app.vault.read(dailyNoteFile);
      console.log(content);
      return content;
    } else {
      return "No daily note found"
    }
  } 

  const contentPromise = getTodayContents();

 
</script>

{#await contentPromise}
    <p>Loading daily note...</p>
{:then content}
    <div class="note-preview">
        {content}
    </div>
{:catch error}
    <p style="color: red">{error.message}</p>
{/await}