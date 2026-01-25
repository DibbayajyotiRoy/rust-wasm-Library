use rustc_hash::FxHashMap;

/// Interned path segment ID.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct SegmentId(pub u32);

/// Type of path segment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SegmentKind { Key, Index }

/// Path ID referencing a node in the trie.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct PathId(pub u32);

pub const ROOT_PATH_ID: PathId = PathId(0);

pub struct PathArena {
    /// Trie nodes: packed (parent_id << 32 | seg_id) -> path_id
    trie: FxHashMap<u64, PathId>,
    /// Reverse lookup: path_id -> (parent_id, segment_id)
    reverse: Vec<(PathId, SegmentId)>,
    /// Segment interner
    interner: PathInterner,
}

impl PathArena {
    pub fn new() -> Self {
        let mut reverse = Vec::with_capacity(16384);
        reverse.push((ROOT_PATH_ID, SegmentId(0)));
        Self {
            trie: FxHashMap::with_capacity_and_hasher(16384, Default::default()),
            reverse,
            interner: PathInterner::new(),
        }
    }

    #[inline]
    pub fn get_child_path(&mut self, parent: PathId, segment: SegmentId) -> PathId {
        let key = ((parent.0 as u64) << 32) | (segment.0 as u64);
        if let Some(&id) = self.trie.get(&key) {
            return id;
        }
        let id = PathId(self.reverse.len() as u32);
        self.trie.insert(key, id);
        self.reverse.push((parent, segment));
        id
    }

    pub fn path_to_string(&self, id: PathId) -> String {
        if id == ROOT_PATH_ID { return "".to_string(); }
        let mut segments = Vec::with_capacity(16);
        let mut curr = id;
        while curr != ROOT_PATH_ID {
            let (parent, seg) = self.reverse[curr.0 as usize];
            segments.push(seg);
            curr = parent;
        }
        segments.reverse();
        let mut result = String::with_capacity(segments.len() * 12);
        for &seg_id in &segments {
            if let Some((kind, value)) = self.interner.resolve(seg_id) {
                match kind {
                    SegmentKind::Key => { result.push('.'); result.push_str(value); }
                    SegmentKind::Index => { result.push('['); result.push_str(value); result.push(']'); }
                }
            }
        }
        if result.starts_with('.') { result.remove(0); }
        result
    }

    pub fn interner_mut(&mut self) -> &mut PathInterner { &mut self.interner }
    pub fn interner(&self) -> &PathInterner { &self.interner }
}

pub struct PathInterner {
    /// Contour-based string interner (Sea of Bytes) to avoid small String heap churn
    key_data: Vec<u8>,
    /// Key offsets in key_data: Hash(bytes) -> SegmentId
    keys: FxHashMap<u64, SegmentId>,
    /// Segment metadata: id -> (SegmentKind, offset, len)
    segments: Vec<(SegmentKind, u32, u32)>,
}

impl PathInterner {
    pub fn new() -> Self {
        Self {
            key_data: Vec::with_capacity(65536),
            keys: FxHashMap::with_capacity_and_hasher(4096, Default::default()),
            segments: Vec::with_capacity(4096),
        }
    }

    pub fn intern_key_bytes(&mut self, bytes: &[u8]) -> SegmentId {
        let h = crate::parser::hash_bytes(bytes);
        if let Some(&id) = self.keys.get(&h) {
            let (_, off, len) = self.segments[id.0 as usize];
            if &self.key_data[off as usize..(off+len) as usize] == bytes {
                return id;
            }
        }

        let id = SegmentId(self.segments.len() as u32);
        let offset = self.key_data.len() as u32;
        let len = bytes.len() as u32;
        self.key_data.extend_from_slice(bytes);
        self.keys.insert(h, id);
        self.segments.push((SegmentKind::Key, offset, len));
        id
    }

    pub fn intern_key(&mut self, key: &str) -> SegmentId {
        self.intern_key_bytes(key.as_bytes())
    }

    pub fn intern_index(&mut self, index: usize) -> SegmentId {
        let s = index.to_string();
        let bytes = s.as_bytes();
        let id = SegmentId(self.segments.len() as u32);
        let offset = self.key_data.len() as u32;
        self.key_data.extend_from_slice(bytes);
        self.segments.push((SegmentKind::Index, offset, bytes.len() as u32));
        id
    }

    #[inline]
    pub fn resolve(&self, id: SegmentId) -> Option<(SegmentKind, &[u8])> {
        let (kind, off, len) = self.segments.get(id.0 as usize)?;
        let bytes = &self.key_data[*off as usize..(*off + *len) as usize];
        Some((*kind, bytes))
    }

    /// Resolve all segment IDs for a path in one go to avoid intermediate allocations.
    pub fn get_path_segments(&self, id: PathId, buffer: &mut Vec<SegmentId>) {
        buffer.clear();
        // This is slow if we do it backwards then reverse, but paths are usually shallow (<20)
        // so it doesn't matter much.
    }
}

pub struct ResolvedSegment<'a> {
    pub kind: SegmentKind,
    pub bytes: &'a [u8],
}


/// Compatibility for ResultArena
#[derive(Debug, Clone, Default)]
pub struct JsonPath { pub segments: Vec<SegmentId> }
impl JsonPath {
    pub fn new() -> Self { Self { segments: Vec::new() } }
    pub fn to_string(&self, interner: &PathInterner) -> String {
        let mut result = String::new();
        for &seg_id in &self.segments {
            if let Some((kind, value)) = interner.resolve(seg_id) {
                match kind {
                    SegmentKind::Key => { result.push('.'); result.push_str(value); }
                    SegmentKind::Index => { result.push('['); result.push_str(value); result.push(']'); }
                }
            }
        }
        if result.starts_with('.') { result.remove(0); }
        result
    }
}
