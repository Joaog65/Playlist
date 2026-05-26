// Constantes que definem o comportamento geral do aplicativo
const REDIRECT_URI = window.location.origin + window.location.pathname;
const SPOTIFY_SCOPES = [
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
];

// Seleciona elementos da página HTML para controlar o que o usuário vê
const linkForm = document.getElementById('link-form');
const playlistLinkInput = document.getElementById('playlist-link');
const inputPanel = document.getElementById('input-panel');
const organizationPanel = document.getElementById('organization-panel');
const resultsPanel = document.getElementById('results-panel');
const createPanel = document.getElementById('create-panel');
const loadingSpinner = document.getElementById('loading-spinner');
const loadingMessage = document.getElementById('loading-message');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const successText = document.getElementById('success-text');
const successButton = document.getElementById('success-button');
const playlistInfo = document.getElementById('playlist-info');
const sortOrder = document.getElementById('sort-order');
const tracksList = document.getElementById('tracks-list');
const trackCount = document.getElementById('track-count');
const backButton = document.getElementById('back-button');
const createButton = document.getElementById('create-button');
const cancelButton = document.getElementById('cancel-button');
const createForm = document.getElementById('create-form');
const newPlaylistNameInput = document.getElementById('new-playlist-name');
const newPlaylistDescriptionInput = document.getElementById('new-playlist-description');
const publicPlaylistCheckbox = document.getElementById('public-playlist');

// Estado do aplicativo: guarda informações que precisam ser usadas em várias partes do código
let state = {
  clientId: null,
  accessToken: null,
  clientToken: null,
  sourcePlaylistId: null,
  sourcePlaylistName: null,
  allTracks: [],
  selectedOrder: '',
};

// Busca o client_id salvo no navegador ou usa um valor padrão
function getClientId() {
  return localStorage.getItem('spotify_client_id') || '4acda8b5ced8464497e8ff18f8b08e04';
}

// Tenta recuperar o token de acesso do Spotify salvo no localStorage
function getAccessToken() {
  return localStorage.getItem('spotify_access_token');
}

// Tenta recuperar um token de cliente salvo no localStorage
function getClientToken() {
  return localStorage.getItem('spotify_client_token');
}

// Salva um token de acesso no localStorage e no estado da aplicação
function saveAccessToken(token) {
  localStorage.setItem('spotify_access_token', token);
  state.accessToken = token;
}

// Salva um token de cliente no localStorage e no estado da aplicação
function saveClientToken(token) {
  localStorage.setItem('spotify_client_token', token);
  state.clientToken = token;
}

// Verifica se já existe um token disponível e, se não existir, tenta buscar um novo
async function getValidToken() {
  const token = getAccessToken();
  if (token) {
    return token;
  }

  const clientToken = getClientToken();
  if (clientToken) {
    return clientToken;
  }

  try {
    const clientId = getClientId();
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(clientId + ':'),
      },
      body: 'grant_type=client_credentials',
    });

    if (response.ok) {
      const data = await response.json();
      saveClientToken(data.access_token);
      return data.access_token;
    }
  } catch (error) {
    console.error('Erro ao obter token:', error);
  }

  return null;
}

// Exibe uma mensagem de erro na tela
function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
  successMessage.classList.add('hidden');
}

// Esconde a mensagem de erro
function hideError() {
  errorMessage.classList.add('hidden');
}

// Exibe uma mensagem de sucesso na tela
function showSuccess(msg) {
  successText.textContent = msg;
  successMessage.classList.remove('hidden');
  errorMessage.classList.add('hidden');
}

// Controla a visualização do carregamento na página
function showLoading(show = true, message = 'Carregando...') {
  if (show) {
    loadingMessage.textContent = message;
    loadingSpinner.classList.remove('hidden');
  } else {
    loadingSpinner.classList.add('hidden');
  }
}

// Extrai o ID da playlist a partir da URL do Spotify
function extractPlaylistId(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const playlistId = pathname.split('/playlist/')[1];
    
    if (playlistId) {
      return playlistId;
    }
    
    const match = url.match(/playlist\/([a-zA-Z0-9-]+)/);
    if (match) {
      return match[1];
    }
  } catch (error) {
    console.error('URL parsing error:', error);
    const match = url.match(/playlist\/([a-zA-Z0-9-]+)/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Busca as faixas da playlist no Spotify e prepara os dados para exibir
async function fetchPlaylistTracks(playlistId) {
  try {
    showLoading(true, 'Carregando playlist...');
    hideError();

    const token = await getValidToken();
    if (!token) {
      throw new Error('Não foi possível obter autorização para acessar a playlist');
    }

    let allTracks = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}`;

    const playlistResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!playlistResponse.ok) {
      if (playlistResponse.status === 404) {
        throw new Error('Playlist não encontrada. Verifique se o link está correto.');
      } else if (playlistResponse.status === 403) {
        throw new Error('Acesso negado à playlist. Verifique se ela é privada.');
      } else {
        throw new Error(`Erro ao acessar playlist: ${playlistResponse.statusText}`);
      }
    }

    const playlistData = await playlistResponse.json();
    state.sourcePlaylistName = playlistData.name;
    playlistInfo.textContent = `${playlistData.name} (${playlistData.tracks.total} faixas)`;

    allTracks.push(...playlistData.tracks.items);

    // Se a playlist tiver várias páginas, percorre os resultados até acabar
    let nextUrl = playlistData.tracks.next;
    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) break;
      const data = await response.json();
      allTracks.push(...data.items);
      nextUrl = data.next;
    }

    state.allTracks = allTracks
      .filter((item) => item.track)
      .map((item) => ({
        uri: item.track.uri,
        name: item.track.name,
        artist: item.track.artists.map((a) => a.name).join(', '),
        album: item.track.album.name,
        duration: item.track.duration_ms,
        year: new Date(item.track.album.release_date).getFullYear(),
      }));

    // Esconde o painel inicial e mostra o painel de organização
    inputPanel.classList.add('hidden');
    organizationPanel.classList.remove('hidden');
    sortOrder.value = '';
    renderTracks();
    showLoading(false);
  } catch (error) {
    showError(`Erro: ${error.message}`);
    showLoading(false);
  }
}

// Retorna as faixas ordenadas de acordo com a opção selecionada
function getSortedTracks() {
  const order = sortOrder.value;
  const tracks = [...state.allTracks];

  if (!order) return tracks;

  if (order === 'artist-asc') {
    return tracks.sort((a, b) =>
      a.artist.localeCompare(b.artist, 'pt-BR', { sensitivity: 'base' })
    );
  }
  if (order === 'artist-desc') {
    return tracks.sort((a, b) =>
      b.artist.localeCompare(a.artist, 'pt-BR', { sensitivity: 'base' })
    );
  }
  if (order === 'name-asc') {
    return tracks.sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }
  if (order === 'name-desc') {
    return tracks.sort((a, b) =>
      b.name.localeCompare(a.name, 'pt-BR', { sensitivity: 'base' })
    );
  }
  if (order === 'album-asc') {
    return tracks.sort((a, b) =>
      a.album.localeCompare(b.album, 'pt-BR', { sensitivity: 'base' })
    );
  }
  if (order === 'album-desc') {
    return tracks.sort((a, b) =>
      b.album.localeCompare(a.album, 'pt-BR', { sensitivity: 'base' })
    );
  }
  if (order === 'duration-asc') {
    return tracks.sort((a, b) => a.duration - b.duration);
  }
  if (order === 'duration-desc') {
    return tracks.sort((a, b) => b.duration - a.duration);
  }
  if (order === 'year-asc') {
    return tracks.sort((a, b) => a.year - b.year);
  }
  if (order === 'year-desc') {
    return tracks.sort((a, b) => b.year - a.year);
  }

  return tracks;
}

// Converte duração em milissegundos para o formato mm:ss
function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Desenha a tabela de faixas na tela com base na lista ordenada
function renderTracks() {
  const tracks = getSortedTracks();
  tracksList.innerHTML = '';
  trackCount.textContent = `${tracks.length} faixa${tracks.length === 1 ? '' : 's'}`;

  if (tracks.length === 0) {
    tracksList.innerHTML = '<tr><td colspan="5">Nenhuma faixa encontrada</td></tr>';
    resultsPanel.classList.add('hidden');
    return;
  }

  resultsPanel.classList.remove('hidden');

  tracks.forEach((track, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>${track.name}</strong></td>
      <td>${track.artist}</td>
      <td>${track.album}</td>
      <td>${formatDuration(track.duration)}</td>
    `;
    tracksList.appendChild(row);
  });
}

function extractTokenFromUrl() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');

  if (token) {
    saveAccessToken(token);
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }

  return false;
}

function initiateAuth() {
  const clientId = getClientId();
  const scopes = SPOTIFY_SCOPES.join('%20');
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scopes}&show_dialog=true`;

  window.location.href = authUrl;
}

async function getUserProfile() {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Erro ao obter perfil:', error);
  }

  return null;
}

async function createPlaylistAndAddTracks(playlistName, description, isPublic) {
  try {
    showLoading(true, 'Criando playlist no Spotify...');

    const user = await getUserProfile();
    if (!user) {
      throw new Error('Não foi possível obter informações do usuário');
    }

    const token = getAccessToken();

    const createResponse = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: playlistName,
        description: description,
        public: isPublic,
      }),
    });

    if (!createResponse.ok) {
      throw new Error('Erro ao criar playlist');
    }

    const newPlaylist = await createResponse.json();
    const newPlaylistId = newPlaylist.id;

    showLoading(true, 'Adicionando faixas...');

    const tracks = getSortedTracks();
    const trackUris = tracks.map((t) => t.uri);

    for (let i = 0; i < trackUris.length; i += 100) {
      const chunk = trackUris.slice(i, i + 100);

      const addResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${newPlaylistId}/tracks`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uris: chunk }),
        }
      );

      if (!addResponse.ok) {
        throw new Error('Erro ao adicionar faixas');
      }
    }

    showLoading(false);
    createPanel.classList.add('hidden');
    organizationPanel.classList.add('hidden');
    inputPanel.classList.remove('hidden');

    const playlistUrl = `https://open.spotify.com/playlist/${newPlaylistId}`;
    showSuccess(
      `✅ Playlist criada com sucesso!\n\n${playlistName}\n${tracks.length} faixas adicionadas\n\nClique no link para abrir: ${playlistUrl}`
    );

    setTimeout(() => {
      window.open(playlistUrl, '_blank');
    }, 500);
  } catch (error) {
    showError(`Erro ao criar playlist: ${error.message}`);
    showLoading(false);
  }
}

linkForm.addEventListener('submit', (e) => {
  e.preventDefault();
  hideError();

  const url = playlistLinkInput.value.trim();

  if (!url) {
    showError('Por favor, cole um link de playlist');
    return;
  }

  const playlistId = extractPlaylistId(url);

  if (!playlistId) {
    showError('Link inválido. Use um link do Spotify como: https://open.spotify.com/playlist/...');
    return;
  }

  console.log('Playlist ID extraído:', playlistId);
  state.sourcePlaylistId = playlistId;
  fetchPlaylistTracks(playlistId);
});

sortOrder.addEventListener('change', renderTracks);

backButton.addEventListener('click', () => {
  organizationPanel.classList.add('hidden');
  resultsPanel.classList.add('hidden');
  createPanel.classList.add('hidden');
  inputPanel.classList.remove('hidden');
  playlistLinkInput.value = '';
  state.allTracks = [];
});

createButton.addEventListener('click', () => {
  organizationPanel.classList.add('hidden');
  resultsPanel.classList.add('hidden');
  createPanel.classList.remove('hidden');
  newPlaylistNameInput.value = `${state.sourcePlaylistName} - Organizada`;
});

cancelButton.addEventListener('click', () => {
  createPanel.classList.add('hidden');
  organizationPanel.classList.remove('hidden');
  resultsPanel.classList.remove('hidden');
});

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const token = getAccessToken();
  if (!token) {
    showLoading(false);
    initiateAuth();
    return;
  }

  const playlistName = newPlaylistNameInput.value.trim();
  const description = newPlaylistDescriptionInput.value.trim();
  const isPublic = publicPlaylistCheckbox.checked;

  if (!playlistName) {
    showError('Nome da playlist é obrigatório');
    return;
  }

  await createPlaylistAndAddTracks(playlistName, description, isPublic);
});

successButton.addEventListener('click', () => {
  successMessage.classList.add('hidden');
});

// Check for token on load
extractTokenFromUrl();

