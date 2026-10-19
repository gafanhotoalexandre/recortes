import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CompositionState } from '@/core/composition/state'
import { App } from './App'

vi.mock('@/features/editor/CanvasSurface', () => ({
  CanvasSurface: ({
    composition,
    mode = 'preview',
  }: {
    composition: CompositionState
    mode?: string
  }) => (
    <canvas
      data-testid={mode === 'preview' ? 'composition-preview' : undefined}
      data-model={composition.modelId}
      data-format={composition.formatId}
    />
  ),
}))
vi.mock('@/features/export/settings', async (original) => ({
  ...await original<typeof import('@/features/export/settings')>(),
  lowResolutionFrames: () => [],
}))

describe('bancada da Fase 3', () => {
  it('apresenta nove modelos, quatro formatos e oito exemplos', () => {
    render(<App />)
    expect(screen.getAllByRole('button', { name: /^Modelo / })).toHaveLength(9)
    expect(
      within(screen.getByRole('combobox', { name: 'Formato da colagem' })).getAllByRole('option'),
    ).toHaveLength(4)
    expect(screen.getAllByRole('button', { name: /^Selecionar foto de exemplo/ })).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Modelo Janela, 4 fotos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('filtra categorias sem perder o modelo selecionado', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Autorais' }))
    expect(screen.getAllByRole('button', { name: /^Modelo / })).toHaveLength(3)
    expect(screen.getByTestId('composition-preview')).toHaveAttribute('data-model', 'janela')
    await user.click(screen.getByRole('button', { name: 'Todas' }))
    expect(screen.getByRole('button', { name: 'Modelo Janela, 4 fotos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('troca modelo e formato mantendo o elemento da prévia e a biblioteca', async () => {
    const user = userEvent.setup()
    render(<App />)
    const preview = screen.getByTestId('composition-preview')
    const library = screen.getByTestId('photo-list')
    await user.click(screen.getByRole('button', { name: 'Modelo Bilhetes, 5 fotos' }))
    await user.selectOptions(screen.getByRole('combobox'), 'landscape')
    await waitFor(() => expect(preview).toHaveAttribute('data-format', 'landscape'))
    expect(screen.getByTestId('composition-preview')).toBe(preview)
    expect(screen.getByTestId('photo-list')).toBe(library)
  })

  it('mantém os controles montados ao navegar entre abas', async () => {
    const user = userEvent.setup()
    render(<App />)
    const caption = document.getElementById('caption')
    await user.click(screen.getByRole('tab', { name: 'Texto' }))
    expect(screen.getByLabelText(/Legenda/)).toBe(caption)
    await user.click(screen.getByRole('tab', { name: 'Papel' }))
    await user.click(screen.getByRole('tab', { name: 'Texto' }))
    expect(screen.getByLabelText(/Legenda/)).toBe(caption)
    expect(caption).toBeEnabled()
  })

  it('seleciona e aplica exemplos, preservando a seleção na troca de modelo', async () => {
    const user = userEvent.setup()
    render(<App />)
    const photo = screen.getByRole('button', { name: 'Selecionar foto de exemplo: O gato' })
    await user.click(photo)
    expect(photo).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('tab', { name: 'Foto' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('O gato')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Modelo Lado a lado, 2 fotos' }))
    expect(photo).toHaveAttribute('aria-pressed', 'true')
  })

  it('habilita importação e apresenta as opções de exportação', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Adicionar fotos' }))
    expect(document.querySelector('input[type=file]')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(screen.getByRole('dialog', { name: 'Exportar colagem' })).toHaveTextContent(
      'Escolha o formato e o tamanho',
    )
    expect(screen.getByLabelText('Arquivo')).toHaveValue('png')
    expect(screen.getByLabelText('Tamanho')).toHaveValue('high')
  })

  it('retorna o foco após fechar ajuda por Escape', async () => {
    const user = userEvent.setup()
    render(<App />)
    const trigger = screen.getByRole('button', { name: 'Como funciona' })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Como funciona' })).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Como funciona' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('recomeça somente após confirmação', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Modelo Arcos, 3 fotos' }))
    await user.selectOptions(screen.getByRole('combobox'), 'square')
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Recomeçar' }))
    await user.click(screen.getByRole('button', { name: 'Continuar aqui' }))
    expect(screen.getByRole('combobox')).toHaveValue('square')
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Recomeçar' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Recomeçar a colagem?' })).getByRole('button', {
        name: 'Recomeçar',
      }),
    )
    expect(screen.getByRole('combobox')).toHaveValue('portrait')
    expect(screen.getByRole('button', { name: 'Modelo Janela, 4 fotos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
