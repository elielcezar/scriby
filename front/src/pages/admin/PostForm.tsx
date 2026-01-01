import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postsService } from '@/services/posts.service';
import { categoriasService } from '@/services/categorias.service';
import { tagsService } from '@/services/tags.service';
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
import { ArrowLeft, Loader2, X, Upload, Sparkles } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Checkbox } from '@/components/ui/checkbox';
import { TagInput } from '@/components/ui/tag-input';

export default function PostForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  // Estado do formulário (single language)
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

  // Estado para criação via prompt
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

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

  // Preencher formulário quando post for carregado
  useEffect(() => {
    if (post && isEdit) {
      const categoriasIds = post.categorias?.map(c => c.id) || [];
      const tagNamesFromPost = post.tags?.map(t => t.nome) || [];

      // Converter data para formato datetime-local (YYYY-MM-DDTHH:mm)
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

      toast({
        title: 'Dados carregados da pauta',
        description: 'O formulário foi preenchido com os dados da sugestão de pauta.',
      });
    }
  }, [location.state, isEdit, toast]);

  // Mutation para criar via prompt
  const generateMutation = useMutation({
    mutationFn: (prompt: string) => postsService.generateFromPrompt(prompt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({
        title: 'Post criado com sucesso!',
        description: 'O post foi gerado e salvo como rascunho. Você pode editá-lo na lista de posts.',
      });
      navigate('/admin/posts');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar post',
        description: error.message || 'Ocorreu um erro ao processar o prompt. Tente novamente.',
      });
      setIsGenerating(false);
    },
  });

  // Mutation para criar post manualmente
  const createMutation = useMutation({
    mutationFn: (data: PostFormData) => postsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({
        title: 'Post criado',
        description: 'O post foi criado com sucesso.',
      });
      navigate('/admin/posts');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar post',
        description: error.message,
      });
    },
  });

  // Mutation para atualizar
  const updateMutation = useMutation({
    mutationFn: (data: Partial<PostFormData>) => postsService.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      toast({
        title: 'Post atualizado',
        description: 'O post foi atualizado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar post',
        description: error.message,
      });
    },
  });

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim();
  };

  const handleTituloChange = (novoTitulo: string) => {
    setFormData(prev => ({
      ...prev,
      titulo: novoTitulo,
      urlAmigavel: generateSlug(novoTitulo),
    }));
  };

  // Handler para criação via prompt
  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) {
      toast({
        variant: 'destructive',
        title: 'Prompt vazio',
        description: 'Digite um link e/ou instruções para gerar o post.',
      });
      return;
    }

    setIsGenerating(true);
    generateMutation.mutate(prompt.trim());
  };

  // Handler para edição/criação manual
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo obrigatório',
        description: 'O título é obrigatório.',
      });
      return;
    }

    if (!formData.chamada.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo obrigatório',
        description: 'A chamada é obrigatória.',
      });
      return;
    }

    if (!formData.conteudo.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo obrigatório',
        description: 'O conteúdo é obrigatório.',
      });
      return;
    }

    if (!formData.urlAmigavel.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo obrigatório',
        description: 'A URL amigável é obrigatória.',
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
    } catch (error) {
      console.error('Erro ao salvar post:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido.',
      });
    }
  };

  const handleChange = (field: keyof PostFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handler para upload de imagem
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validar tamanho do arquivo (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'A imagem não pode exceder 10MB.',
      });
      e.target.value = '';
      return;
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Tipo de arquivo inválido',
        description: 'Apenas JPEG, JPG, PNG e WEBP são permitidos.',
      });
      e.target.value = '';
      return;
    }

    // Adicionar nova imagem
    setFormData(prev => ({
      ...prev,
      imagens: [file],
      oldImages: [], // Substituir imagens antigas
    }));

    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImages([reader.result as string]);
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  // Remover imagem
  const handleRemoveImage = () => {
    setFormData(prev => ({
      ...prev,
      imagens: [],
      oldImages: [],
    }));
    setPreviewImages([]);
  };

  // Toggle categoria
  const toggleCategoria = (categoriaId: number) => {
    setSelectedCategorias(prev => {
      const updated = prev.includes(categoriaId)
        ? prev.filter(id => id !== categoriaId)
        : [...prev, categoriaId];
      // Sincronizar com formData
      setFormData(formData => ({
        ...formData,
        categorias: updated,
      }));
      return updated;
    });
  };

  // Handler para busca de tags (autocomplete)
  const handleTagSearch = (query: string) => {
    setTagSearchQuery(query);
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Tela de loading durante processamento (criação via prompt)
  if (!isEdit && isGenerating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Criando post...</h2>
            <p className="text-muted-foreground">
              Processando seu prompt e gerando conteúdo com IA. Isso pode levar alguns segundos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading ao buscar post para edição
  if (isEdit && isLoadingPost) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se for criação, mostrar interface de prompt
  if (!isEdit) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/posts')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Novo Post</h1>
            <p className="text-muted-foreground">
              Cole um link e/ou escreva instruções para gerar o post automaticamente
            </p>
          </div>
        </div>

        <form onSubmit={handlePromptSubmit}>
          <Card className="max-w-4xl mx-auto">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Exemplo: https://example.com/noticia - Escreva sobre o impacto na indústria da música eletrônica, focando nas tendências de 2025..."
                    className="min-h-[300px] text-base resize-none"
                    disabled={isGenerating}
                  />
                  <p className="text-sm text-muted-foreground">
                    Você pode colar apenas um link, apenas instruções, ou ambos. A IA irá processar e criar o post automaticamente.
                  </p>
                </div>

                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/admin/posts')}
                    disabled={isGenerating}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isGenerating || !prompt.trim()}>
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Gerar Post
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    );
  }

  // Se for edição, mostrar formulário completo
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/posts')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Editar Post</h1>
          <p className="text-muted-foreground">
            Edite as informações do post
          </p>
        </div>
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
              <p className="text-sm text-muted-foreground">
                Slug para URL (ex: meu-primeiro-post). Gerado automaticamente do título.
              </p>
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
                placeholder="Resumo ou chamada do post (aparece nas listagens)"
              />
            </div>

            {/* Imagem de Capa */}
            <div className="space-y-2">
              <Label>Imagem de Capa</Label>
              <p className="text-sm text-muted-foreground">
                Formatos aceitos: JPEG, JPG, PNG, WEBP (máximo 10MB)
              </p>
              <div className="space-y-4">
                {/* Preview da imagem */}
                {previewImages.length > 0 && (
                  <div className="relative w-full max-w-md">
                    <img
                      src={previewImages[0]}
                      alt="Imagem de capa"
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={handleRemoveImage}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Input de upload */}
                {previewImages.length === 0 && (
                  <div className="flex items-center gap-4">
                    <Input
                      id="imagem-capa"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={isLoading}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('imagem-capa')?.click()}
                      disabled={isLoading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Selecionar Imagem de Capa
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
              <p className="text-sm text-muted-foreground">
                Use o editor para formatar o texto com negrito, itálico, listas e mais.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'RASCUNHO' | 'PUBLICADO') => handleChange('status', value)}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                    <SelectItem value="PUBLICADO">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataPublicacao">Data de Publicação</Label>
                <Input
                  id="dataPublicacao"
                  type="datetime-local"
                  value={formData.dataPublicacao}
                  onChange={(e) => handleChange('dataPublicacao', e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label>Destaque</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="destaque"
                    checked={formData.destaque}
                    onCheckedChange={(checked) => handleChange('destaque', checked)}
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="destaque"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Marcar como destaque
                  </label>
                </div>
              </div>
            </div>

            {/* Categorias */}
            <div className="space-y-2">
              <Label>Categorias</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categorias?.map((categoria) => (
                  <div key={categoria.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`categoria-${categoria.id}`}
                      checked={selectedCategorias.includes(categoria.id)}
                      onCheckedChange={() => toggleCategoria(categoria.id)}
                      disabled={isLoading}
                    />
                    <label
                      htmlFor={`categoria-${categoria.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {categoria.nome}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput
                value={tagNames}
                onChange={setTagNames}
                suggestions={tagSuggestions}
                onSearch={handleTagSearch}
                disabled={isLoading}
                placeholder="Digite tags separadas por vírgula (ex: música, festival, eletrônica)..."
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/posts')}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
