export type Usage = 'none' | 'low' | 'medium' | 'high'
export type Option = { title: string; detail: string; usage?: Usage }
export type Offer = { title: string; options: Option[]; at: number; suggested?: number | null; isFree?: boolean }

declare module 'claude-code' {
  interface PluginState {
    then: { offer: Offer | null; isOn: boolean; color: string | null; selected: number[] | null; theme: string | null }
  }
}
