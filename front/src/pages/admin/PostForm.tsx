import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postsService } from '@/services/posts.service';
import { categoriasService } from '@/services/categorias.service';
import { tagsService } from '@/services/tags.service';
import { chatService, ChatMessage } from '@/services/chat.service';
import { PostFormData } from '@/types/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, X, Upload, Sparkles, Send, Bot, User, PencilLine, RotateCcw } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Checkbox } from '@/components/ui/checkbox';
import { TagInput } from '@/components/ui/tag-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';

export default function PostForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Estado do formulário
  const [formData, setFormData] = useState<PostFormData>({
    titulo: '',
    chamada: '',
    conteudo: '',
    urlAmigavel: '',
    status: 'RASCUNHO',
    destaque: false,
    dataPublicacao: '',
    categorias: [],
    tags: [],
    imagens: [],
    oldImages: [],
  });

  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [selectedCategorias, setSelectedCategorias] = useState<number[]>([]);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  // Estado para Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = sessionStorage.getItem('scriby_chat_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse chat session', e);
      }
    }
    return [
      { role: 'assistant', content: 'Olá! Sou seu assistente editorial. Cole um link ou descreva o tema da notícia que deseja criar hoje.' }
    ];
  });
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [showEditor, setShowEditor] = useState(isEdit);

  // Persistir chat na sessão
  useEffect(() => {
    if (chatMessages.length > 0) {
      sessionStorage.setItem('scriby_chat_session', JSON.stringify(chatMessages));
    }
  }, [chatMessages]);

  // Buscar categorias
  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => categoriasService.getAll(),
  });

  // Buscar tags para autocomplete
  const { data: tagSuggestions = [] } = useQuery({
    queryKey: ['tags', 'search', tagSearchQuery],
    queryFn: () => tagsService.search(tagSearchQuery),
    enabled: tagSearchQuery.length > 0,
  });

  // Buscar post se for edição
  const { data: post, isLoading: isLoadingPost } = useQuery({
    queryKey: ['post', id],
    queryFn: () => postsService.getById(Number(id)),
    enabled: isEdit && !!id,
  });

  // Auto-scroll para o fim do chat
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [chatMessages]);

  // Preencher formulário quando post for carregado
  useEffect(() => {
    if (post && isEdit) {
      const categoriasIds = post.categorias?.map(c => c.id) || [];
      const tagNamesFromPost = post.tags?.map(t => t.nome) || [];

      let dataFormatada = '';
      if (post.dataPublicacao) {
        const date = new Date(post.dataPublicacao);
        dataFormatada = date.toISOString().slice(0, 16);
      }

      setFormData({
        titulo: post.titulo || '',
        chamada: post.chamada || '',
        conteudo: post.conteudo || '',
        urlAmigavel: post.urlAmigavel || '',
        status: post.status || 'RASCUNHO',
        destaque: post.destaque || false,
        dataPublicacao: dataFormatada,
        categorias: categoriasIds,
        tags: [],
        imagens: [],
        oldImages: post.imagens || [],
      });

      setPreviewImages(post.imagens || []);
      setSelectedCategorias(categoriasIds);
      setTagNames(tagNamesFromPost);
      setShowEditor(true);
    }
  }, [post, isEdit]);

  // Preencher formulário com dados da pauta (se vier de conversão)
  useEffect(() => {
    const pautaData = location.state?.fromPauta;
    if (pautaData && !isEdit) {
      setFormData(prev => ({
        ...prev,
        titulo: pautaData.titulo || '',
        chamada: pautaData.chamada || '',
        conteudo: pautaData.conteudo || '',
        urlAmigavel: generateSlug(pautaData.titulo || ''),
      }));
      setShowEditor(true);
      toast({
        title: 'Dados carregados da pauta',
        description: 'O formulário foi preenchido com os dados da sugestão de pauta.',
      });
    }
  }, [location.state, isEdit, toast]);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Função auxiliar para detectar e extrair JSON de post da resposta da IA
  const extractPostDataFromResponse = (response: string): { hasPost: boolean; data?: Partial<PostFormData>; cleanMessage?: string } => {
    // Tentar encontrar JSON na resposta (pode estar em blocos de código ou direto)
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const jsonMatch = response.match(jsonRegex);
    
    if (jsonMatch) {
      try {
        const parsedData = JSON.parse(jsonMatch[1]);
        // Verificar se contém campos de post
        if (parsedData.titulo || parsedData.conteudo) {
          return {
            hasPost: true,
            data: {
              titulo: parsedData.titulo || '',
              chamada: parsedData.chamada || '',
              conteudo: parsedData.conteudo || '',
              urlAmigavel: parsedData.titulo ? generateSlug(parsedData.titulo) : '',
            },
            cleanMessage: response.replace(jsonRegex, '').trim(),
          };
        }
      } catch (e) {
        console.error('Erro ao parsear JSON da IA', e);
        // Se falhar ao parsear, retornar como mensagem normal
        return { hasPost: false };
      }
    }
    
    // Tentar detectar JSON direto (sem blocos de código)
    try {
      const directJsonMatch = response.match(/\{[\s\S]*"titulo"[\s\S]*\}/);
      if (directJsonMatch) {
        const parsedData = JSON.parse(directJsonMatch[0]);
        if (parsedData.titulo || parsedData.conteudo) {
          return {
            hasPost: true,
            data: {
              titulo: parsedData.titulo || '',
              chamada: parsedData.chamada || '',
              conteudo: parsedData.conteudo || '',
              urlAmigavel: parsedData.titulo ? generateSlug(parsedData.titulo) : '',
            },
            cleanMessage: response.replace(directJsonMatch[0], '').trim(),
          };
        }
      }
    } catch (e) {
      // Ignorar erros de parsing
    }
    
    return { hasPost: false };
  };

  const handleTituloChange = (novoTitulo: string) => {
    setFormData(prev => ({
      ...prev,
      titulo: novoTitulo,
      urlAmigavel: generateSlug(novoTitulo),
    }));
  };

  const handleClearChat = () => {
    if (window.confirm('Tem certeza que deseja limpar o histórico do chat?')) {
      const initialMsg: ChatMessage = { role: 'assistant', content: 'Olá! Sou seu assistente editorial. Cole um link ou descreva o tema da notícia que deseja criar hoje.' };
      setChatMessages([initialMsg]);
      sessionStorage.removeItem('scriby_chat_session');
      toast({ title: 'Chat limpo' });
    }
  };

  // Lógica de Chat
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading || isGeneratingPost) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput };
    const newMessages = [...chatMessages, userMessage];
    
    // Adicionar mensagem do usuário ao chat imediatamente
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Tentar extrair URL da mensagem para contexto
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = chatInput.match(urlRegex);
      const urlContext = urls ? urls[0] : undefined;

      const aiResponse = await chatService.sendMessage(newMessages, urlContext);
      
      // Verificar se a resposta contém JSON de post ANTES de adicionar ao chat
      const postData = extractPostDataFromResponse(aiResponse);

      if (postData.hasPost && postData.data) {
        // Modo de geração de post - processar silenciosamente
        setIsChatLoading(false);
        setIsGeneratingPost(true);
        
        // Mostrar toast de geração
        toast({
          title: 'Gerando seu post...',
          description: 'Isso pode levar alguns segundos. Aguarde.',
          duration: 3000,
        });

        // Preencher formulário silenciosamente
        setFormData(prev => ({
          ...prev,
          titulo: postData.data!.titulo || prev.titulo,
          chamada: postData.data!.chamada || prev.chamada,
          conteudo: postData.data!.conteudo || prev.conteudo,
          urlAmigavel: postData.data!.urlAmigavel || prev.urlAmigavel,
        }));

        // Aguardar um momento para feedback visual e então redirecionar
        setTimeout(() => {
          setIsGeneratingPost(false);
          setShowEditor(true);
          toast({
            title: 'Post gerado com sucesso!',
            description: 'Revise e publique quando estiver pronto.',
            duration: 4000,
          });
        }, 1000);

        // NÃO adicionar mensagem ao chat quando for geração de post
        return;
      }

      // Se não for geração de post, adicionar mensagem normalmente ao chat
      const assistantMessage: ChatMessage = { 
        role: 'assistant', 
        content: aiResponse 
      };
      setChatMessages(prev => [...prev, assistantMessage]);

    } catch (error: unknown) {
      // Em caso de erro, adicionar mensagem de erro ao chat para contexto
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      const chatErrorMessage: ChatMessage = {
        role: 'assistant',
        content: `Desculpe, ocorreu um erro: ${errorMessage}. Por favor, tente novamente.`
      };
      setChatMessages(prev => [...prev, chatErrorMessage]);
      
      toast({
        variant: 'destructive',
        title: 'Erro na conversa',
        description: errorMessage,
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  // Handler para edição/criação manual
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo.trim() || !formData.chamada.trim() || !formData.conteudo.trim() || !formData.urlAmigavel.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha título, chamada, conteúdo e URL amigável.',
      });
      return;
    }

    try {
      const tagIds = await tagsService.resolveTagIds(tagNames);

      const dataToSubmit: PostFormData = {
        ...formData,
        categorias: selectedCategorias.length > 0 ? selectedCategorias : formData.categorias || [],
        tags: tagIds,
        imagens: formData.imagens,
        oldImages: previewImages,
      };

      if (isEdit) {
        updateMutation.mutate(dataToSubmit);
      } else {
        createMutation.mutate(dataToSubmit);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao salvar';
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: errorMessage,
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: PostFormData) => postsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({ title: 'Post criado com sucesso!' });
      navigate('/admin/posts');
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao criar post', description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<PostFormData>) => postsService.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      toast({ title: 'Post atualizado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao atualizar post', description: error.message });
    },
  });

  const handleChange = (field: keyof PostFormData, value: PostFormData[keyof PostFormData]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande' });
      return;
    }
    setFormData(prev => ({ ...prev, imagens: [file], oldImages: [] }));
    const reader = new FileReader();
    reader.onloadend = () => setPreviewImages([reader.result as string]);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, imagens: [], oldImages: [] }));
    setPreviewImages([]);
  };

  const toggleCategoria = (categoriaId: number) => {
    setSelectedCategorias(prev => {
      const updated = prev.includes(categoriaId) ? prev.filter(id => id !== categoriaId) : [...prev, categoriaId];
      setFormData(f => ({ ...f, categorias: updated }));
      return updated;
    });
  };

  const handleTagSearch = (query: string) => setTagSearchQuery(query);

  const isLoading = createMutation.isPending || updateMutation.isPending;

  if (isEdit && isLoadingPost) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se estiver no modo Chat (Criação)
  if (!showEditor && !isEdit) {
    return (
      <div className="flex flex-col h-[calc(100vh-12rem)] space-y-6 relative">
        {/* Overlay de geração de post */}
        {isGeneratingPost && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
            <Card className="max-w-md w-full mx-4">
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <div>
                    <h3 className="text-lg font-semibold">Gerando seu post...</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Isso pode levar alguns segundos. Você será redirecionado para o editor em instantes.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/posts')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Novo Post</h1>
              <p className="text-muted-foreground">Converse com a IA para estruturar sua notícia</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={handleClearChat} title="Limpar Chat" disabled={isGeneratingPost}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setShowEditor(true)} className="gap-2" disabled={isGeneratingPost}>
              <PencilLine className="h-4 w-4" />
              Pular para Editor
            </Button>
          </div>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4 max-w-4xl mx-auto">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`mt-1 p-2 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <div className={`prose prose-sm dark:prose-invert max-w-none ${msg.role === 'user' ? 'text-primary-foreground prose-p:text-primary-foreground prose-headings:text-primary-foreground prose-strong:text-primary-foreground' : ''}`}>
                        <ReactMarkdown>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {(isChatLoading || isGeneratingPost) && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="mt-1 p-2 rounded-full bg-muted h-8 w-8 flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="p-3 rounded-lg bg-muted flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs animate-pulse">
                        {isGeneratingPost ? 'Gerando post...' : 'Pensando...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-background">
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ex: Escreva sobre o novo álbum do Tiësto..."
                className="flex-1"
                disabled={isChatLoading || isGeneratingPost}
              />
              <Button type="submit" disabled={isChatLoading || isGeneratingPost || !chatInput.trim()}>
                {(isChatLoading || isGeneratingPost) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <p className="text-[10px] text-center text-muted-foreground mt-2">
              A IA pode gerar posts estruturados. Você será redirecionado automaticamente para o editor quando o post estiver pronto.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Se estiver no modo Editor (Edição ou após Chat)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => isEdit ? navigate('/admin/posts') : setShowEditor(false)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEdit ? 'Editar Post' : 'Revisar Post'}
            </h1>
            <p className="text-muted-foreground">
              {isEdit ? 'Edite as informações do post' : 'Ajuste os detalhes finais antes de publicar'}
            </p>
          </div>
        </div>
        {!isEdit && (
          <Button variant="outline" onClick={() => setShowEditor(false)} className="gap-2">
            <Bot className="h-4 w-4" />
            Voltar para Chat
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informações do Post</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => handleTituloChange(e.target.value)}
                required
                disabled={isLoading}
                placeholder="Digite o título do post"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="urlAmigavel">URL Amigável *</Label>
              <Input
                id="urlAmigavel"
                value={formData.urlAmigavel}
                onChange={(e) => handleChange('urlAmigavel', e.target.value)}
                required
                disabled={isLoading}
                placeholder="titulo-do-post"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chamada">Chamada *</Label>
              <Textarea
                id="chamada"
                value={formData.chamada}
                onChange={(e) => handleChange('chamada', e.target.value)}
                required
                disabled={isLoading}
                rows={3}
                placeholder="Resumo ou chamada do post"
              />
            </div>

            <div className="space-y-2">
              <Label>Imagem de Capa</Label>
              <div className="space-y-4">
                {previewImages.length > 0 && (
                  <div className="relative w-full max-w-md">
                    <img src={previewImages[0]} alt="Capa" className="w-full h-48 object-cover rounded-lg border" />
                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={handleRemoveImage} disabled={isLoading}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {previewImages.length === 0 && (
                  <div className="flex items-center gap-4">
                    <Input id="imagem-capa" type="file" accept="image/*" onChange={handleImageChange} disabled={isLoading} className="hidden" />
                    <Button type="button" variant="outline" onClick={() => document.getElementById('imagem-capa')?.click()} disabled={isLoading}>
                      <Upload className="h-4 w-4 mr-2" /> Selecionar Imagem
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conteudo">Conteúdo *</Label>
              <RichTextEditor
                content={formData.conteudo}
                onChange={(html) => handleChange('conteudo', html)}
                className={isLoading ? 'opacity-50 pointer-events-none' : ''}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(v: string) => handleChange('status', v)} disabled={isLoading}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                    <SelectItem value="PUBLICADO">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataPublicacao">Data de Publicação</Label>
                <Input id="dataPublicacao" type="datetime-local" value={formData.dataPublicacao} onChange={(e) => handleChange('dataPublicacao', e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label>Destaque</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox id="destaque" checked={formData.destaque} onCheckedChange={(c) => handleChange('destaque', c === true)} disabled={isLoading} />
                  <label htmlFor="destaque" className="text-sm font-medium">Marcar destaque</label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categorias</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categorias?.map((c) => (
                  <div key={c.id} className="flex items-center space-x-2">
                    <Checkbox id={`cat-${c.id}`} checked={selectedCategorias.includes(c.id)} onCheckedChange={() => toggleCategoria(c.id)} disabled={isLoading} />
                    <label htmlFor={`cat-${c.id}`} className="text-sm font-medium">{c.nome}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput value={tagNames} onChange={setTagNames} suggestions={tagSuggestions} onSearch={handleTagSearch} disabled={isLoading} />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Salvar Alterações' : 'Criar Post'}
              </Button>
              <Button type="button" variant="outline" onClick={() => isEdit ? navigate('/admin/posts') : setShowEditor(false)} disabled={isLoading}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
