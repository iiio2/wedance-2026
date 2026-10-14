<script setup lang="ts">
/**
 * A venue's rooms (bookable_spaces) in its Business editor, as previews with
 * Edit: name, how many people, floor, price info, a photo and a few lines.
 * The page saves them with its Save button (business.saveSpaces).
 *
 *   <BusinessVenueRooms v-model="rooms" />
 */
import { Plus, X, Pencil, Check, DoorOpen } from 'lucide-vue-next'

export type Room = { id?: string; name: string; capacity: number | null; floorType: string; priceInfo: string; description: string; imageUrl: string | null }
const rooms = defineModel<Room[]>({ required: true })
const open = ref<number | null>(null)
function add() {
  rooms.value.push({ name: '', capacity: null, floorType: '', priceInfo: '', description: '', imageUrl: null })
  open.value = rooms.value.length - 1
}
function remove(i: number) {
  rooms.value.splice(i, 1)
  open.value = null
}
</script>

<template>
  <section class="rounded-2xl border bg-card p-5 shadow-wd-card">
    <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Rooms</h2>
    <p class="mt-1 text-sm text-muted-foreground">The spaces organizers can ask for: a main hall, a second room, the terrace. With one room, you can skip this.</p>
    <ul class="mt-3 grid gap-2">
      <li v-for="(r, i) in rooms" :key="r.id ?? `new-${i}`" class="rounded-xl border">
        <div class="flex items-center gap-3 px-3 py-2 text-sm">
          <img v-if="r.imageUrl" :src="r.imageUrl" alt="" class="size-10 shrink-0 rounded-lg object-cover">
          <div v-else class="grid size-10 shrink-0 place-items-center rounded-lg bg-muted"><DoorOpen class="size-4 text-muted-foreground" aria-hidden="true" /></div>
          <span class="min-w-0 flex-1 truncate">
            <span class="font-bold">{{ r.name || 'Untitled room' }}</span>
            <span class="text-muted-foreground">{{ [r.capacity && `${r.capacity} people`, r.floorType, r.priceInfo].filter(Boolean).map(x => ` · ${x}`).join('') }}</span>
          </span>
          <Button type="button" variant="ghost" size="sm" :aria-expanded="open === i" @click="open = open === i ? null : i"><template v-if="open === i"><Check /> Done</template><template v-else><Pencil /> Edit</template></Button>
        </div>
        <div v-if="open === i" class="grid gap-3 border-t p-3 sm:grid-cols-3">
          <Field :id="`room-name-${i}`" label="Name" class="sm:col-span-3"><Input v-model="r.name" placeholder="Main hall" /></Field>
          <Field :id="`room-cap-${i}`" label="People" optional><Input v-model.number="r.capacity" type="number" min="1" /></Field>
          <Field :id="`room-floor-${i}`" label="Floor" optional><Input v-model="r.floorType" placeholder="Parquet" /></Field>
          <Field :id="`room-price-${i}`" label="Price" optional><Input v-model="r.priceInfo" placeholder="€60 per hour" /></Field>
          <Field :id="`room-desc-${i}`" label="About this room" optional class="sm:col-span-3"><Textarea v-model="r.description" :rows="2" /></Field>
          <Field label="Photo" optional class="sm:col-span-3"><div class="max-w-xs"><ImageUpload v-model="r.imageUrl" folder="profiles" /></div></Field>
          <div class="sm:col-span-3"><Button type="button" variant="ghost" size="sm" class="text-destructive" @click="remove(i)"><X /> Remove this room</Button></div>
        </div>
      </li>
    </ul>
    <Button type="button" variant="ghost" size="sm" class="mt-2" @click="add"><Plus /> Add a room</Button>
  </section>
</template>
