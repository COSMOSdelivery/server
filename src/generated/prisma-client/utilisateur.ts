import { Role } from '@prisma/client'
import { ApiProperty } from '@nestjs/swagger'

export class Utilisateur {
	@ApiProperty({ type: Number })
	id: number

	@ApiProperty({ type: String })
	nom: string

	@ApiProperty({ type: String })
	prenom: string

	@ApiProperty({ type: String })
	nomShop: string

	@ApiProperty({ type: String })
	email: string

	@ApiProperty({ type: String })
	gouvernerat: string

	@ApiProperty({ type: String })
	password: string

	@ApiProperty({ type: String })
	ville: string

	@ApiProperty({ type: String })
	localite: string

	@ApiProperty({ type: String })
	codePostal: string

	@ApiProperty({ type: String })
	addresse: string

	@ApiProperty({ type: String })
	telephone1: string

	@ApiProperty({ type: String })
	telephone2: string

	@ApiProperty({ type: String })
	codeTVA: string

	@ApiProperty({ type: String })
	cin: string

	@ApiProperty({ enum: Role, enumName: 'Role' })
	role: Role

	@ApiProperty({ type: Date })
	dateInscription: Date

	@ApiProperty({ type: Date })
	derniereMiseAJour: Date
}
