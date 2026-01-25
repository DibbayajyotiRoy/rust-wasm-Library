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
    pub fn new(mode: crate::config::ComputeMode) -> Self {
        let (trie_cap, rev_cap) = match mode {
            crate::config::ComputeMode::Throughput => (32768, 32768),
            crate::config::ComputeMode::Edge => (1024, 1024),
            _ => (16384, 16384), // Latency/Default
        };

        let mut reverse = Vec::with_capacity(rev_cap);
        reverse.push((ROOT_PATH_ID, SegmentId(0)));
        Self {
            trie: FxHashMap::with_capacity_and_hasher(trie_cap, Default::default()),
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

    pub fn clear(&mut self) {
        self.trie.clear();
        self.reverse.truncate(1); // Keep root
        self.interner.clear();
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
                let s = std::str::from_utf8(value).unwrap_or("");
                match kind {
                    SegmentKind::Key => { 
                        if !result.is_empty() { result.push('.'); }
                        result.push_str(s); 
                    }
                    SegmentKind::Index => { result.push('['); result.push_str(s); result.push(']'); }
                }
            }
        }
        result
    }

    pub fn get_path_segments(&self, id: PathId, buffer: &mut Vec<SegmentId>) {
        buffer.clear();
        if id == ROOT_PATH_ID { return; }
        let mut curr = id;
        while curr != ROOT_PATH_ID {
            let (parent, seg) = self.reverse[curr.0 as usize];
            buffer.push(seg);
            curr = parent;
        }
        buffer.reverse();
    }

    pub fn interner_mut(&mut self) -> &mut PathInterner { &mut self.interner }
    pub fn interner(&self) -> &PathInterner { &self.interner }
}

pub struct PathInterner {
    key_data: Vec<u8>,
    keys: FxHashMap<u64, SegmentId>,
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
        let mut buf = [0u8; 20];
        let mut n = index;
        let mut pos = 20;
        if n == 0 {
            pos -= 1;
            buf[pos] = b'0';
        } else {
            while n > 0 {
                pos -= 1;
                buf[pos] = b'0' + (n % 10) as u8;
                n /= 10;
            }
        }
        let bytes = &buf[pos..];
        
        let id = SegmentId(self.segments.len() as u32);
        let offset = self.key_data.len() as u32;
        let len = bytes.len() as u32;
        self.key_data.extend_from_slice(bytes);
        self.segments.push((SegmentKind::Index, offset, len));
        id
    }

    pub fn clear(&mut self) {
        self.key_data.clear();
        self.keys.clear();
        self.segments.clear();
    }

    pub fn resolve(&self, id: SegmentId) -> Option<(SegmentKind, &[u8])> {
        let (kind, off, len) = self.segments.get(id.0 as usize)?;
        let bytes = &self.key_data[*off as usize..(*off + *len) as usize];
        Some((*kind, bytes))
    }
}
